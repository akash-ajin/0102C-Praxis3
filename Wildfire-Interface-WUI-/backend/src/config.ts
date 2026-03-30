/**
 * Configuration for serial sensor data integration.
 * These values can be overridden via environment variables.
 */

// Serial port for Pico 3 receiver
// On Windows: e.g., "COM3", "COM4"
// On Linux/Mac: e.g., "/dev/ttyUSB0", "/dev/ttyACM0"
export const SERIAL_PORT = process.env.SERIAL_PORT || "COM3";

// Baud rate for serial communication with Pico 3
export const BAUD_RATE = parseInt(process.env.BAUD_RATE || "115200", 10);

// Mock mode: if true, generates random sensor data instead of reading serial
// Useful for testing the frontend without hardware connected
export const MOCK_MODE = process.env.MOCK_MODE === "true";

// Mock data update interval in milliseconds
export const MOCK_UPDATE_INTERVAL = parseInt(process.env.MOCK_UPDATE_INTERVAL || "2000", 10);

// Debug mode: if true, logs raw 5-digit codes as they arrive
export const DEBUG_MODE = process.env.DEBUG_MODE === "true";

/**
 * Sensor field tag mapping.
 * Maps 5-digit code format to sensor names.
 * Format: (first_digit, last_digit) -> sensor_name
 */
export const SENSOR_TAG_MAP: Record<string, string> = {
  "1_0": "bme_temp",
  "2_0": "bme_hum",
  "3_0": "bme_press",
  "4_0": "bme_gas",
  "5_0": "am_temp",
  "4_1": "am_hum",
  "1_1": "encoder",
  "2_1": "anemometer",
  "3_1": "soil"
};

export const SENSOR_NAMES = [
  "bme_temp",
  "bme_hum",
  "bme_press",
  "bme_gas",
  "am_temp",
  "am_hum",
  "encoder",
  "anemometer",
  "soil"
];
