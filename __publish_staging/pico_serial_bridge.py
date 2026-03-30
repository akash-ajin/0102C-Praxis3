#!/usr/bin/env python3
"""
Pico Serial Bridge
==================
Minimal serial port reader for Pico 3 (RF receiver).
Reads USB serial data, buffers & parses 5-digit codes, exposes via HTTP.

Usage:
    python pico_serial_bridge.py      # Default COM3 @ 115200 baud
    python pico_serial_bridge.py --port COM5 --baud 9600
    python pico_serial_bridge.py --mock  # Generate random test data

Environment variables:
    PICO_SERIAL_PORT       Device (default: COM3)
    PICO_BAUD_RATE         Speed (default: 115200)
    PICO_MOCK_MODE=1       Use random test data
    PICO_DEBUG=1           Log every code received
    PICO_ANEMO_DIVISOR     Encoded-to-m/s divisor (default: 27.44)
    PICO_ANEMO_ZERO_MS     Zero-offset in m/s to remove base drift (default: 0.3)
    PICO_ANEMO_DEADBAND_MS Clamp to zero below this adjusted speed (default: 0.05)
    PICO_ENCODER_COUNTS    Encoder counts per full rotation (default: 80)
    PICO_ENCODER_MODE      direct | offset500 | auto (default: auto)
    PICO_ENCODER_OFFSET_DEG Direction offset in degrees (default: 0)
    PICO_ENCODER_INVERT    Set 1/true to invert direction (default: 0)
    PICO_DISRUPTION_WINDOW Rolling packet window for disruption check (default: 40)
    PICO_DISRUPTION_MIN    Min packets before alerting (default: 15)
    PICO_DISRUPTION_RATIO  Invalid ratio threshold for alert (default: 0.35)
"""

import os
import sys
import json
import time
import argparse
import threading
import random
from datetime import datetime, UTC
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urljoin
from typing import Dict, Optional

# Try to import pyserial; if not available, suggest installation
try:
    import serial
except ImportError:
    print("ERROR: pyserial not found. Install it with:")
    print("  pip install pyserial")
    sys.exit(1)

# ==================== CONFIGURATION ====================

SERIAL_PORT = os.environ.get("PICO_SERIAL_PORT", "COM3")
BAUD_RATE = int(os.environ.get("PICO_BAUD_RATE", "115200"))
MOCK_MODE = os.environ.get("PICO_MOCK_MODE", "").lower() in ("1", "true", "yes")
DEBUG_MODE = os.environ.get("PICO_DEBUG", "").lower() in ("1", "true", "yes")
HTTP_PORT = int(os.environ.get("PICO_HTTP_PORT", "5175"))
# Wind-speed calibration divisor (m/s = encoded / divisor).
# Calibrated from field test where previous 4.2 km/h should be ~2.126 m/s.
ANEMO_DIVISOR = float(os.environ.get("PICO_ANEMO_DIVISOR", "27.44"))
ANEMO_ZERO_OFFSET_MS = float(os.environ.get("PICO_ANEMO_ZERO_MS", "0.3"))
ANEMO_DEADBAND_MS = float(os.environ.get("PICO_ANEMO_DEADBAND_MS", "0.05"))
ENCODER_COUNTS_PER_REV = max(1, int(os.environ.get("PICO_ENCODER_COUNTS", "80")))
ENCODER_MODE = os.environ.get("PICO_ENCODER_MODE", "auto").strip().lower()
ENCODER_OFFSET_DEG = float(os.environ.get("PICO_ENCODER_OFFSET_DEG", "0"))
ENCODER_INVERT = os.environ.get("PICO_ENCODER_INVERT", "0").lower() in ("1", "true", "yes")
DISRUPTION_WINDOW = max(5, int(os.environ.get("PICO_DISRUPTION_WINDOW", "40")))
DISRUPTION_MIN_EVENTS = max(1, int(os.environ.get("PICO_DISRUPTION_MIN", "15")))
DISRUPTION_INVALID_RATIO = float(os.environ.get("PICO_DISRUPTION_RATIO", "0.35"))

if ENCODER_MODE not in {"auto", "direct", "offset500"}:
    ENCODER_MODE = "auto"

# Sensor tag mapping: (first_digit, last_digit) -> sensor_name
SENSOR_TAG_MAP = {
    ("1", "5"): "bme_temp",
    ("1", "0"): "bme_temp",
    ("2", "0"): "bme_hum",
    ("3", "0"): "bme_press",
    ("4", "0"): "bme_gas",
    ("5", "0"): "am_temp",
    ("4", "1"): "am_hum",
    ("1", "1"): "encoder",
    ("2", "1"): "anemometer",
    ("3", "1"): "soil",
}

# ==================== DECODING FUNCTIONS ====================
# These reverse the encoding from sensors.py

def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")

def decode_temp(encoded: int) -> float:
    """Reverse: encode_temp(temp_c) = (temp_c + 40.0) * 10"""
    return (encoded / 10.0) - 40.0

def decode_humidity(encoded: int) -> float:
    """Reverse: encode_humidity(h) = h * 10"""
    return encoded / 10.0

def decode_pressure(encoded: int) -> float:
    """Reverse: encode_pressure(p) = p - 900"""
    return encoded + 900.0

def decode_encoder(encoded: int) -> float:
    """
    Convert encoder value to wind direction in degrees.
    Supports both payload formats:
    - 0..80 direct position values
    - 500..580 offset values (position + 500)
    """
    if ENCODER_MODE == "direct":
        position = encoded % ENCODER_COUNTS_PER_REV
    elif ENCODER_MODE == "offset500":
        position = (encoded - 500) % ENCODER_COUNTS_PER_REV
    else:
        # auto mode:
        # - current firmware sends wrapped counts in 0..(counts-1)
        # - legacy firmware sends position+500, typically in ~500 range
        if encoded >= 400:
            position = (encoded - 500) % ENCODER_COUNTS_PER_REV
        else:
            position = encoded % ENCODER_COUNTS_PER_REV

    degrees = (position / ENCODER_COUNTS_PER_REV) * 360.0
    if ENCODER_INVERT:
        degrees = (360.0 - degrees) % 360.0
    degrees = (degrees + ENCODER_OFFSET_DEG) % 360.0
    return degrees

def decode_anemometer(encoded: int) -> float:
    """
    Convert encoded voltage to wind speed in m/s.
    encoded = voltage * 1000 (mV)
    raw_speed = encoded / ANEMO_DIVISOR
    adjusted_speed = max(0, raw_speed - ANEMO_ZERO_OFFSET_MS)
    apply deadband to suppress tiny fluctuations around zero
    """
    raw_speed = encoded / ANEMO_DIVISOR
    adjusted_speed = max(0.0, raw_speed - ANEMO_ZERO_OFFSET_MS)
    if adjusted_speed < ANEMO_DEADBAND_MS:
        return 0.0
    return adjusted_speed

def decode_soil_voltage(encoded: int) -> float:
    """
    Reverse of sensors.py soil encoding:
      encode_soil_voltage(v) = v * 300
    Returns soil voltage in V with ~0.0033 V resolution.
    """
    return encoded / 300.0

def decode_gas(encoded: int) -> float:
    """Reverse: encode_gas(g) = g / 1000.0"""
    return encoded * 1000.0

# Sensor-specific decoders
SENSOR_DECODERS = {
    "bme_temp": decode_temp,
    "bme_hum": decode_humidity,
    "bme_press": decode_pressure,
    "bme_gas": decode_gas,
    "am_temp": decode_temp,
    "am_hum": decode_humidity,
    "encoder": decode_encoder,
    "anemometer": decode_anemometer,
    "soil": decode_soil_voltage,
}

# ==================== SENSOR STORE ====================

class SensorStore:
    """Threads-safe store for sensor data."""
    
    def __init__(self):
        self.data: Dict[str, Optional[float]] = {
            "bme_temp": None,
            "bme_hum": None,
            "bme_press": None,
            "bme_gas": None,
            "am_temp": None,
            "am_hum": None,
            "encoder": None,
            "anemometer": None,
            "soil": None,
        }
        self.last_update = utc_now_iso()
        self.last_raw_code: Optional[str] = None
        self.valid_packets = 0
        self.invalid_packets = 0
        self.recent_packets: list[int] = []
        self.last_invalid_code: Optional[str] = None
        self.last_invalid_reason: Optional[str] = None
        self.last_invalid_at: Optional[str] = None
        self.lock = threading.Lock()

    def _record_packet_locked(
        self, valid: bool, code: Optional[str], reason: Optional[str]
    ) -> None:
        if valid:
            self.valid_packets += 1
            self.recent_packets.append(1)
        else:
            self.invalid_packets += 1
            self.recent_packets.append(0)
            self.last_invalid_code = code
            self.last_invalid_reason = reason
            self.last_invalid_at = utc_now_iso()

        if len(self.recent_packets) > DISRUPTION_WINDOW:
            self.recent_packets = self.recent_packets[-DISRUPTION_WINDOW:]

    def record_invalid_packet(self, code: Optional[str], reason: str) -> None:
        with self.lock:
            self._record_packet_locked(False, code, reason)

    def _build_diagnostics_locked(self) -> Dict:
        total_packets = self.valid_packets + self.invalid_packets
        window_packets = len(self.recent_packets)
        valid_recent = sum(self.recent_packets)
        invalid_recent = window_packets - valid_recent
        recent_invalid_ratio = (
            (invalid_recent / window_packets) if window_packets > 0 else 0.0
        )
        communication_disruption = (
            window_packets >= DISRUPTION_MIN_EVENTS
            and recent_invalid_ratio >= DISRUPTION_INVALID_RATIO
        )

        return {
            "totalPackets": total_packets,
            "validPackets": self.valid_packets,
            "invalidPackets": self.invalid_packets,
            "recentWindowPackets": window_packets,
            "recentInvalidPackets": invalid_recent,
            "recentInvalidRatio": round(recent_invalid_ratio, 3),
            "communicationDisruption": communication_disruption,
            "alertMessage": (
                "Communications disruption detected (high invalid packet rate)"
                if communication_disruption
                else None
            ),
            "lastInvalidCode": self.last_invalid_code,
            "lastInvalidReason": self.last_invalid_reason,
            "lastInvalidAt": self.last_invalid_at,
            "thresholds": {
                "minPackets": DISRUPTION_MIN_EVENTS,
                "invalidRatio": DISRUPTION_INVALID_RATIO,
                "windowPackets": DISRUPTION_WINDOW,
            },
        }
    
    def update_from_code(self, code: str) -> bool:
        """Parse a 5-digit code and update store. Returns True if valid."""
        if len(code) != 5 or not code.isdigit():
            self.record_invalid_packet(code, "invalid_code_format")
            return False
        
        first_digit = code[0]
        last_digit = code[4]
        encoded_str = code[1:4]
        
        # Look up sensor name
        tag = (first_digit, last_digit)
        sensor_name = SENSOR_TAG_MAP.get(tag)
        
        if not sensor_name:
            if DEBUG_MODE:
                print(f"[Sensor] Unknown tag: {tag} (code: {code})")
            self.record_invalid_packet(code, "unknown_sensor_tag")
            return False
        
        try:
            encoded_value = int(encoded_str)
        except ValueError:
            self.record_invalid_packet(code, "invalid_encoded_value")
            return False
        
        # Decode using sensor-specific decoder
        decoder = SENSOR_DECODERS.get(sensor_name)
        if not decoder:
            if DEBUG_MODE:
                print(f"[Sensor] No decoder for {sensor_name}")
            self.record_invalid_packet(code, "missing_sensor_decoder")
            return False
        
        try:
            decoded_value = decoder(encoded_value)
        except Exception as e:
            if DEBUG_MODE:
                print(f"[Sensor] Decode error for {sensor_name}: {e}")
            self.record_invalid_packet(code, "sensor_decode_error")
            return False
        
        with self.lock:
            self.data[sensor_name] = decoded_value
            self.last_update = utc_now_iso()
            self.last_raw_code = code
            self._record_packet_locked(True, code, None)
        
        if DEBUG_MODE:
            print(f"[Sensor] Parsed: {code} -> {sensor_name} = {decoded_value:.2f}")
        
        return True
    
    def update_with_mock_data(self):
        """Generate random sensor values for testing (already decoded)."""
        with self.lock:
            self.data = {
                "bme_temp": round(random.uniform(-20, 50), 1),           # Celsius
                "bme_hum": round(random.uniform(20, 95), 1),             # %
                "bme_press": round(random.uniform(950, 1050), 2),        # hPa
                "bme_gas": round(random.uniform(50000, 500000), 0),      # Ohms
                "am_temp": round(random.uniform(-20, 50), 1),            # Celsius
                "am_hum": round(random.uniform(20, 95), 1),              # %
                "encoder": round(random.uniform(0, 80), 1),              # 0-80 = 0-360° (wind direction)
                "anemometer": round(random.uniform(0.0, 20.0), 2),       # m/s (0.05V = 1m/s calibration)
                "soil": round(random.uniform(0.5, 3.3), 2),              # Voltage (V) soil moisture
            }
            self.last_update = utc_now_iso()
            self.last_raw_code = "MOCK"
    
    def get_response(self) -> Dict:
        """Get current data as API response."""
        with self.lock:
            return {
                "sensors": dict(self.data),
                "lastUpdate": self.last_update,
                "rawCode": self.last_raw_code,
                "diagnostics": self._build_diagnostics_locked(),
            }
    
    def get_raw_code(self) -> Dict:
        """Get last raw code for debugging."""
        with self.lock:
            return {
                "lastRawCode": self.last_raw_code,
                "timestamp": utc_now_iso(),
            }


# ==================== SERIAL READER ====================

class SerialReader:
    """Reads serial data from Pico 3, buffers bytes, extracts 5-digit codes."""
    
    def __init__(self, port: str, baud: int, store: SensorStore):
        self.port_name = port
        self.baud_rate = baud
        self.store = store
        self.serial_port: Optional[serial.Serial] = None
        self.buffer = ""
        self.running = False
    
    def connect(self) -> bool:
        """Open serial port. Returns True if successful."""
        try:
            self.serial_port = serial.Serial(
                port=self.port_name,
                baudrate=self.baud_rate,
                timeout=1
            )
            print(f"[Serial] Connected to {self.port_name} @ {self.baud_rate} baud")
            return True
        except serial.SerialException as e:
            print(f"[Serial] Error: {e}")
            return False
    
    def process_buffer(self):
        """Extract 5-digit codes from buffer."""
        i = 0
        while i < len(self.buffer):
            char = self.buffer[i]
            
            # Skip non-digits
            if not char.isdigit():
                i += 1
                continue
            
            # Check if next 4 chars form a 5-digit code
            if i + 5 <= len(self.buffer):
                candidate = self.buffer[i:i + 5]
                
                if candidate.isdigit():
                    first = candidate[0]
                    last = candidate[4]
                    
                    # Validate tag format
                    # Support legacy and current bme_temp end digit ("5")
                    if first in "12345" and last in "015":
                        # Valid code
                        if DEBUG_MODE:
                            print(f"[Serial] Extracted: {candidate}")
                        self.store.update_from_code(candidate)
                        i += 5
                        continue
                    else:
                        self.store.record_invalid_packet(candidate, "invalid_tag_format")
            
            i += 1
        
        # Clear processed data
        self.buffer = self.buffer[i:]
        
        # Prevent buffer overflow
        if len(self.buffer) > 1000:
            if DEBUG_MODE:
                print("[Serial] Buffer overflow; clearing")
            self.buffer = ""
    
    def run(self):
        """Main loop: read serial data and extract codes."""
        self.running = True
        print("[Serial] Reader started")
        
        while self.running and self.serial_port and self.serial_port.is_open:
            try:
                if self.serial_port.in_waiting:
                    data = self.serial_port.read(self.serial_port.in_waiting)
                    self.buffer += data.decode("utf-8", errors="ignore")
                    self.process_buffer()
                else:
                    time.sleep(0.01)
            except Exception as e:
                print(f"[Serial] Error reading: {e}")
                time.sleep(0.1)
        
        print("[Serial] Reader stopped")
    
    def close(self):
        """Close serial port."""
        self.running = False
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()


# ==================== HTTP SERVER ====================

class RequestHandler(BaseHTTPRequestHandler):
    """Simple HTTP request handler to serve sensor data."""
    
    @classmethod
    def set_store(cls, store: SensorStore):
        cls.store = store
    
    def do_GET(self):
        """Handle GET requests."""
        if self.path == "/api/sensors":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = self.store.get_response()
            self.wfile.write(json.dumps(response).encode())
        
        elif self.path == "/api/sensors/raw":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = self.store.get_raw_code()
            self.wfile.write(json.dumps(response).encode())
        
        elif self.path == "/healthz":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode())
        
        else:
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode())
    
    def log_message(self, format, *args):
        """Suppress default logging; use custom format."""
        print(f"[HTTP] {format % args}")


# ==================== MAIN ====================

def main():
    global DEBUG_MODE
    parser = argparse.ArgumentParser(
        description="Read sensor data from Pico 3 RF receiver"
    )
    parser.add_argument(
        "--port",
        default=SERIAL_PORT,
        help=f"Serial port (default: {SERIAL_PORT})"
    )
    parser.add_argument(
        "--baud",
        type=int,
        default=BAUD_RATE,
        help=f"Baud rate (default: {BAUD_RATE})"
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Generate random test data"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )
    
    args = parser.parse_args()
    
    # Use args or environment variables
    use_mock = args.mock or MOCK_MODE
    use_debug = args.debug or DEBUG_MODE
    DEBUG_MODE = use_debug
    port = args.port
    baud = args.baud
    
    print("=" * 60)
    print("Pico Serial Bridge")
    print("=" * 60)
    print(f"Serial Port: {port}")
    print(f"Baud Rate: {baud}")
    print(f"Mock Mode: {use_mock}")
    print(f"Debug Mode: {use_debug}")
    print(f"HTTP Port: {HTTP_PORT}")
    print("-" * 60)
    
    # Create sensor store
    store = SensorStore()
    RequestHandler.set_store(store)
    
    # Start mock data thread if requested
    if use_mock:
        print("[Main] MOCK_MODE enabled; generating random data")
        
        def mock_loop():
            while True:
                store.update_with_mock_data()
                time.sleep(2)
        
        mock_thread = threading.Thread(target=mock_loop, daemon=True)
        mock_thread.start()
    
    else:
        # Start serial reader thread
        reader = SerialReader(port, baud, store)
        if not reader.connect():
            print("[Main] Failed to connect to serial port")
            print("[Main] Tip: Try --mock for testing, or verify Pico is connected")
        
        reader_thread = threading.Thread(target=reader.run, daemon=True)
        reader_thread.start()
    
    # Start HTTP server
    try:
        server = HTTPServer(("127.0.0.1", HTTP_PORT), RequestHandler)
        print(f"[HTTP] Listening on http://127.0.0.1:{HTTP_PORT}")
        print(f"[HTTP] Visit http://127.0.0.1:{HTTP_PORT}/api/sensors to get data")
        print("\nPress Ctrl+C to stop\n")
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Main] Shutting down...")
    except Exception as e:
        print(f"[Main] Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
