# Pico Sensor Integration Guide

## Overview

This document describes how live sensor data from your Raspberry Pi Pico 3 (RF receiver) flows into your website.

**Data Flow:**
```
Pico 1 (Sensors)
    ↓ UART
Pico 2 (RF Bridge)
    ↓ RF Transmission
Pico 3 (RF Receiver, USB-connected)
    ↓ Serial (5-digit codes)
    ↓
Python Bridge (pico_serial_bridge.py)
    + Serial reader + Parser + HTTP API
    ↓
Backend (Express.js on port 5174)
    + Proxies /api/sensors to bridge
    ↓
Frontend (React on port 5173)
    + fetch /api/sensors
    ↓
Website displays live values
```

---

## Quick Start

### 1. Install Dependencies

**Backend (Node.js):**
```bash
cd backend
npm install
```

**Python Bridge:**
```bash
# Python was already configured by the setup
# pyserial should already be installed
python pico_serial_bridge.py --help
```

### 2. Start in Development (No Hardware)

**Terminal 1: Python Bridge (Mock Mode)**
```bash
python pico_serial_bridge.py --mock
```

Expected output:
```
============================================================
Pico Serial Bridge
============================================================
Serial Port: COM3
Baud Rate: 115200
Mock Mode: True
Debug Mode: False
HTTP Port: 5175
------------------------------------------------------------
[HTTP] Listening on http://127.0.0.1:5175
[HTTP] Visit http://127.0.0.1:5175/api/sensors to get data

Press Ctrl+C to stop
```

**Terminal 2: Backend**
```bash
cd backend
npm run dev
```

Expected output:
```
[Server] Backend listening on http://localhost:5174
[Server] Note: Sensor endpoints will proxy to Python bridge on port 5175
```

**Terminal 3: Frontend**
```bash
cd frontend
npm run dev
```

### 3. Verify Connection

```bash
# Test Python bridge directly
curl http://127.0.0.1:5175/api/sensors

# Test through backend
curl http://localhost:5174/api/sensors
```

---

## Architecture

### Three-Process Architecture

1. **Python Bridge** (`pico_serial_bridge.py`)
   - Reads from USB serial port connected to Pico 3
   - Buffers incoming bytes
   - Extracts and validates 5-digit codes
   - Exposes HTTP API on port 5175

2. **Express Backend** (`backend/src/server.ts`)
   - Proxies `/api/sensors` requests to Python bridge
   - Provides consistent API for frontend
   - Runs on port 5174

3. **React Frontend** (`frontend/`)
   - Fetches sensor data from backend `/api/sensors`
   - Displays live values
   - Runs on port 5173

### Why This Design?

- ✅ Avoids Node.js native module build issues on Windows
- ✅ Python handles serial communication natively
- ✅ Clear separation of concerns
- ✅ Easy testing (mock mode works independently)
- ✅ Frontend doesn't need changes
- ✅ Can replace Python bridge with C# or other language later

---

## How to Run with Hardware

### Prerequisites
- Pico 3 connected to PC via USB
- Pico 3 is running `reciever.py`
- Pico 1 and 2 are transmitting data

### Find Your Serial Port

**Windows:**
```bash
# List COM ports
Get-WmiObject -Class Win32_SerialPort | Select-Object Name, Description
```

**Linux/Mac:**
```bash
ls /dev/tty*
```

### Start with Hardware

**Terminal 1: Python Bridge**
```bash
# Default port is COM3
python pico_serial_bridge.py

# Or specify custom port:
python pico_serial_bridge.py --port COM5

# Or with debugging:
python pico_serial_bridge.py --port COM5 --debug
```

**Terminal 2: Backend** (same as before)
```bash
cd backend && npm run dev
```

**Terminal 3: Frontend** (same as before)
```bash
cd frontend && npm run dev
```

### Verify Serial Connection

```bash
# Check raw codes received
curl http://127.0.0.1:5175/api/sensors/raw

# Response should show lastRawCode like "14235" (not null)
```

---

## API Endpoints

### GET /api/sensors
Returns all sensor readings (through backend proxy).

**Endpoint:** `http://localhost:5174/api/sensors`

**Response:**
```json
{
  "sensors": {
    "bme_temp": 423.5,
    "bme_hum": 675.2,
    "bme_press": 945.1,
    "bme_gas": 50000,
    "am_temp": 380.0,
    "am_hum": 620.0,
    "encoder": 123,
    "anemometer": 450.5,
    "soil": 700.0
  },
  "lastUpdate": "2026-03-28T10:30:45Z",
  "rawCode": "14235"
}
```

### GET /api/sensors/raw
Returns last received 5-digit code (for debugging).

**Endpoint:** `http://localhost:5174/api/sensors/raw`

**Response:**
```json
{
  "lastRawCode": "14235",
  "timestamp": "2026-03-28T10:30:45Z"
}
```

---

## Python Bridge Configuration

### Command-Line Arguments

```bash
python pico_serial_bridge.py [OPTIONS]
```

Options:
- `--port COM5` – Serial port (default: COM3)
- `--baud 9600` – Baud rate (default: 115200)
- `--mock` – Generate random test data
- `--debug` – Log every received code

### Environment Variables

- `PICO_SERIAL_PORT` – Serial port (e.g., `COM3`)
- `PICO_BAUD_RATE` – Baud rate (e.g., `115200`)
- `PICO_MOCK_MODE` – Set to `1` for mock mode
- `PICO_DEBUG` – Set to `1` for debug logging
- `PICO_HTTP_PORT` – HTTP server port (default: 5175)

### Examples

```bash
# Mock mode (no hardware needed)
python pico_serial_bridge.py --mock

# Custom serial port
PICO_SERIAL_PORT=COM5 python pico_serial_bridge.py

# Debug mode (logs every code)
python pico_serial_bridge.py --debug

# Combination
python pico_serial_bridge.py --port COM5 --debug
```

---

## Frontend Integration

### Simplest Approach: Fetch on Page Load

```typescript
import { useEffect, useState } from "react";

export function SensorDisplay() {
  const [sensors, setSensors] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sensors")
      .then(r => r.json())
      .then(data => setSensors(data.sensors))
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div>Error: {error}</div>;
  if (!sensors) return <div>Loading...</div>;

  return (
    <div>
      <p>Temperature: {sensors.bme_temp?.toFixed(1)}°C</p>
      <p>Humidity: {sensors.bme_hum?.toFixed(1)}%</p>
      <p>Wind: {sensors.anemometer?.toFixed(1)} m/s</p>
    </div>
  );
}
```

### Better: Live Updates with Polling

```typescript
import { useEffect, useState } from "react";

export function LiveSensorDisplay() {
  const [sensors, setSensors] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/sensors");
        const data = await res.json();
        setSensors(data.sensors);
      } catch (err) {
        console.error("Failed to fetch sensors:", err);
      }
    };

    // Fetch immediately
    fetchData();

    // Then poll every 2 seconds
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!sensors) return <div>Waiting for sensor data...</div>;

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      <div className="bg-blue-100 p-4 rounded">
        <h3 className="font-bold">Temperature</h3>
        <p className="text-2xl">{sensors.bme_temp?.toFixed(1)}°</p>
      </div>
      <div className="bg-green-100 p-4 rounded">
        <h3 className="font-bold">Humidity</h3>
        <p className="text-2xl">{sensors.bme_hum?.toFixed(1)}%</p>
      </div>
      <div className="bg-yellow-100 p-4 rounded">
        <h3 className="font-bold">Wind Speed</h3>
        <p className="text-2xl">{sensors.anemometer?.toFixed(1)}</p>
      </div>
      <div className="bg-purple-100 p-4 rounded">
        <h3 className="font-bold">Pressure</h3>
        <p className="text-2xl">{sensors.bme_press?.toFixed(1)}</p>
      </div>
      <div className="bg-red-100 p-4 rounded">
        <h3 className="font-bold">Gas</h3>
        <p className="text-2xl">{sensors.bme_gas?.toFixed(0)}</p>
      </div>
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-bold">Soil</h3>
        <p className="text-2xl">{sensors.soil?.toFixed(1)}</p>
      </div>
    </div>
  );
}
```

Add this component to your page and it will automatically poll the backend every 2 seconds, displaying live sensor values.

---

## Troubleshooting

### Python Bridge Won't Start

**Error:** `ModuleNotFoundError: No module named 'serial'`

**Solution:** Install pyserial
```bash
pip install pyserial
```

### Can't Find Serial Port

**Windows:**
```bash
Get-WmiObject -Class Win32_SerialPort | Select-Object Name, Description
```

Then run:
```bash
python pico_serial_bridge.py --port COM5
```

### lastRawCode is null

This means no valid codes have been received yet. Check:

1. **Is Pico 3 running?**
   - Check Pico 3 serial console (should print 5-digit codes)

2. **Are Pico 1 and 2 running?**
   - Data flows: Pico 1 → UART → Pico 2 → RF → Pico 3

3. **Enable debug mode to see raw input:**
   ```bash
   python pico_serial_bridge.py --debug
   ```

4. **Try a different serial port:**
   ```bash
   python pico_serial_bridge.py --port COM4
   python pico_serial_bridge.py --port COM5
   ```

### No Data in Frontend

1. Check backend is running: `curl http://localhost:5174/healthz`
2. Check Python bridge is running: `curl http://127.0.0.1:5175/api/sensors`
3. Check there are no CORS errors in browser console

---

## Sensor Field Mapping

Each 5-digit code represents one sensor reading.

**Format:** `[first_digit][encoded_value][last_digit]`

| First | Last | Sensor Name | Unit |
|-------|------|-------------|------|
| 1 | 0 | bme_temp | °C (encoded) |
| 2 | 0 | bme_hum | % (encoded) |
| 3 | 0 | bme_press | hPa (encoded) |
| 4 | 0 | bme_gas | Ohms (encoded) |
| 5 | 0 | am_temp | °C (encoded) |
| 4 | 1 | am_hum | % (encoded) |
| 1 | 1 | encoder | counts |
| 2 | 1 | anemometer | m/s (encoded) |
| 3 | 1 | soil | ADC (encoded) |

**Example:** `14235`
- First digit: `1` → bme_temp
- Encoded value: `423`
- Last digit: `5` → (variant)
- Sensor: `bme_temp`, raw value: `423`

To understand the encoding (converting 423 to temperature), check the Pico firmware.

---

## Files Added/Modified

**Created:**
- `pico_serial_bridge.py` – Python serial reader & HTTP server
- `SENSOR_INTEGRATION_README.md` – This file
- `SENSOR_INTEGRATION_QUICKSTART.sh` – Quick reference

**Modified:**
- `backend/src/server.ts` – Added `/api/sensors` & `/api/sensors/raw` proxies
- Backend files removed/kept as reference:
  - `backend/src/config.ts` – (kept, not used)
  - `backend/src/sensors.ts` – (kept, not used)
  - `backend/src/serial-reader.ts` – (kept, not used)

---

## Summary

| Component | Port | Language | Purpose |
|-----------|------|----------|---------|
| Python Bridge | 5175 | Python | Read USB serial, parse 5-digit codes, serve HTTP |
| Backend | 5174 | Node.js/TS | API proxy, CORS, FWI endpoints |
| Frontend | 5173 | React/TS | Display sensor values |

---

## Next Steps

1. **Test with mock data:**
   ```bash
   python pico_serial_bridge.py --mock
   ```

2. **Test with hardware:**
   ```bash
   python pico_serial_bridge.py --port COM3
   ```

3. **Add display component** to your React frontend

4. **Future:** Replace HTTP polling with WebSocket for true real-time updates
