/**
 * Sensor data store and parsing logic.
 * Maintains the latest sensor values and provides parsing for 5-digit codes.
 */

import { SENSOR_TAG_MAP, SENSOR_NAMES, DEBUG_MODE } from "./config";

export type SensorName =
  | "bme_temp"
  | "bme_hum"
  | "bme_press"
  | "bme_gas"
  | "am_temp"
  | "am_hum"
  | "encoder"
  | "anemometer"
  | "soil";

export interface SensorData {
  [key: string]: number | null;
  bme_temp: number | null;
  bme_hum: number | null;
  bme_press: number | null;
  bme_gas: number | null;
  am_temp: number | null;
  am_hum: number | null;
  encoder: number | null;
  anemometer: number | null;
  soil: number | null;
}

export interface SensorResponse {
  sensors: SensorData;
  lastUpdate: string;
  rawCode: string | null;
}

/**
 * Central sensor data store.
 * Maintains the latest received value for each sensor field.
 */
export class SensorStore {
  private data: SensorData;
  private lastUpdate: Date;
  private lastRawCode: string | null = null;

  constructor() {
    this.data = this.initializeData();
    this.lastUpdate = new Date();
  }

  /**
   * Initialize all sensor fields to null.
   */
  private initializeData(): SensorData {
    const data: Partial<SensorData> = {};
    for (const name of SENSOR_NAMES) {
      (data as Record<string, null>)[name] = null;
    }
    return data as SensorData;
  }

  /**
   * Parse a 5-digit code and update the store.
   * Format: [first_digit][3_encoded_digits][last_digit]
   * Example: 16420 -> bme_temp with encoded value 642
   */
  updateFromCode(code: string): boolean {
    if (code.length !== 5) {
      return false;
    }

    const firstDigit = code[0];
    const lastDigit = code[4];
    const encodedValue = code.substring(1, 4);

    // Look up sensor name from tag map
    const tagKey = `${firstDigit}_${lastDigit}`;
    const sensorName = SENSOR_TAG_MAP[tagKey];

    if (!sensorName) {
      if (DEBUG_MODE) {
        console.warn(`[Sensor] Unknown tag: ${tagKey} (code: ${code})`);
      }
      return false;
    }

    // Decode the 3-digit middle value
    const decodedValue = parseInt(encodedValue, 10);

    // Update store
    this.data[sensorName as SensorName] = decodedValue;
    this.lastUpdate = new Date();
    this.lastRawCode = code;

    if (DEBUG_MODE) {
      console.log(
        `[Sensor] Parsed: ${code} -> ${sensorName} = ${decodedValue}`
      );
    }

    return true;
  }

  /**
   * Get all current sensor data.
   */
  getData(): SensorData {
    return { ...this.data };
  }

  /**
   * Get formatted response for API.
   */
  getResponse(): SensorResponse {
    return {
      sensors: this.getData(),
      lastUpdate: this.lastUpdate.toISOString(),
      rawCode: this.lastRawCode
    };
  }

  /**
   * Get the last received raw code (for debugging).
   */
  getLastRawCode(): string | null {
    return this.lastRawCode;
  }

  /**
   * Update with mock data for testing (generates random values).
   */
  updateWithMockData(): void {
    // Simulate realistic sensor ranges
    this.data.bme_temp = Math.random() * 50; // 0-50°C
    this.data.bme_hum = Math.random() * 100; // 0-100%
    this.data.bme_press = 900 + Math.random() * 100; // 900-1000 hPa
    this.data.bme_gas = Math.random() * 500000; // Ohms
    this.data.am_temp = Math.random() * 50;
    this.data.am_hum = Math.random() * 100;
    this.data.encoder = Math.floor(Math.random() * 1000); // 0-999
    this.data.anemometer = Math.random() * 30; // 0-30 m/s
    this.data.soil = Math.random() * 1000; // 0-1000 (arbitrary units)

    this.lastUpdate = new Date();
    this.lastRawCode = "MOCK";

    if (DEBUG_MODE) {
      console.log("[Sensor] Mock data updated");
    }
  }
}

/**
 * Global singleton instance.
 */
let instance: SensorStore | null = null;

export function getSensorStore(): SensorStore {
  if (!instance) {
    instance = new SensorStore();
  }
  return instance;
}
