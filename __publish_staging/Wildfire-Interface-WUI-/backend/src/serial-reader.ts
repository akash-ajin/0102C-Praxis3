/**
 * Serial reader for Pico 3 receiver.
 * Handles USB serial connection, byte buffering, and 5-digit code reconstruction.
 * Does NOT assume newline-separated packets; buffers raw bytes.
 */

import { SerialPort } from "serialport";
import { getSensorStore } from "./sensors";
import { SERIAL_PORT, BAUD_RATE, DEBUG_MODE } from "./config";

export class SerialReader {
  private port: SerialPort | null = null;
  private buffer: string = "";
  private isConnected = false;

  /**
   * Initialize the serial connection.
   * Returns a promise that resolves when the port is ready.
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.port = new SerialPort(
          {
            path: SERIAL_PORT,
            baudRate: BAUD_RATE
          },
          (err) => {
            if (err) {
              console.error(`[Serial] Failed to open ${SERIAL_PORT}: ${err.message}`);
              reject(err);
              return;
            }
            console.log(`[Serial] Connected to ${SERIAL_PORT} @ ${BAUD_RATE} baud`);
            this.isConnected = true;
            resolve();
          }
        );

        this.port.on("data", this.onDataReceived.bind(this));
        this.port.on("error", this.onError.bind(this));
        this.port.on("close", this.onClose.bind(this));
      } catch (err) {
        console.error(`[Serial] Error during initialization: ${err}`);
        reject(err);
      }
    });
  }

  /**
   * Handle incoming serial data.
   * Buffers raw bytes and extracts 5-digit codes whenever they appear.
   * The Pico prints raw 5-digit codes without strict newline separation,
   * so we buffer everything and look for valid digit patterns.
   */
  private onDataReceived(data: Buffer): void {
    // Append incoming bytes to buffer
    this.buffer += data.toString("utf8");

    if (DEBUG_MODE) {
      console.log(`[Serial] Received (raw): "${data.toString("utf8")}"`);
    }

    // Process buffer looking for 5-digit codes
    this.processBuffer();
  }

  /**
   * Extract 5-digit codes from buffer.
   * A valid 5-digit code:
   * - Consists of exactly 5 digits
   * - First digit is 1-5
   * - Last digit is 0-1
   * - Can have non-digit characters before/after (like spaces, newlines, etc.)
   *
   * This function keeps the buffer intact and extracts complete codes,
   * leaving non-matching characters or incomplete sequences for the next batch.
   */
  private processBuffer(): void {
    const store = getSensorStore();

    // Process buffer character by character
    let i = 0;
    while (i < this.buffer.length) {
      const char = this.buffer[i];

      // Skip non-digit characters
      if (!this.isDigit(char)) {
        i++;
        continue;
      }

      // Found a digit; check if next 4 chars form a valid 5-digit code
      if (i + 5 <= this.buffer.length) {
        const candidate = this.buffer.substring(i, i + 5);

        // Check if all are digits
        if (this.isAllDigits(candidate)) {
          const firstDigit = candidate[0];
          const lastDigit = candidate[4];

          // Validate tag format (first digit 1-5, last digit 0-1)
          if (
            firstDigit >= "1" &&
            firstDigit <= "5" &&
            (lastDigit === "0" || lastDigit === "1")
          ) {
            // Valid code found!
            if (DEBUG_MODE) {
              console.log(`[Serial] Extracted valid code: ${candidate}`);
            }

            store.updateFromCode(candidate);

            // Move past this code
            i += 5;
            continue;
          }
        }
      }

      // Not a valid code starting at this position; skip this digit
      i++;
    }

    // Clear buffer of already-processed content
    // We keep any trailing incomplete data
    this.buffer = this.buffer.slice(i);

    // If buffer gets too large (e.g., lots of garbage data), clear it
    if (this.buffer.length > 1000) {
      if (DEBUG_MODE) {
        console.warn("[Serial] Buffer overflow; clearing");
      }
      this.buffer = "";
    }
  }

  /**
   * Helper: check if string is a single digit.
   */
  private isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  /**
   * Helper: check if all characters in string are digits.
   */
  private isAllDigits(str: string): boolean {
    return str.length === 5 && /^\d{5}$/.test(str);
  }

  /**
   * Error handler.
   */
  private onError(err: Error): void {
    console.error(`[Serial] Error: ${err.message}`);
  }

  /**
   * Close handler.
   */
  private onClose(): void {
    console.log("[Serial] Port closed");
    this.isConnected = false;
  }

  /**
   * Close the serial connection.
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.port && this.port.isOpen) {
        this.port.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Check if port is currently connected.
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }
}

/**
 * Global singleton instance.
 */
let instance: SerialReader | null = null;

export function getSerialReader(): SerialReader {
  if (!instance) {
    instance = new SerialReader();
  }
  return instance;
}
