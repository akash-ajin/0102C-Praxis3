/**
 * Fire Danger Index Calculator
 * Real-time fire danger calculation using sensor data.
 * Not a true Canadian FWI calculation (which requires historical daily data).
 */

export interface SensorData {
  bme_temp: number | null;
  bme_hum: number | null;
  anemometer: number | null;
  [key: string]: number | null;
}

export interface FireDangerResult {
  index: number; // 0-100 scale
  level: "low" | "moderate" | "high" | "very_high" | "extreme";
  description: string;
  conditions: string[];
}

/**
 * Calculate a real-time fire danger index (0-100).
 *
 * Model goals:
 * - Temperature, humidity, and wind all matter.
 * - Dryness alone should not overstate risk in mild/calm conditions.
 * - Risk rises sharply when dry + hot and/or windy occur together.
 */
export function calculateFireDangerIndex(sensors: SensorData): FireDangerResult {
  if (
    sensors.bme_temp === null ||
    sensors.bme_hum === null ||
    sensors.anemometer === null
  ) {
    return {
      index: 0,
      level: "low",
      description: "Waiting for sensor data...",
      conditions: ["No sensor data available"],
    };
  }

  const temp = sensors.bme_temp;
  const humidity = sensors.bme_hum;
  const windSpeedMs = sensors.anemometer;
  const windSpeedKmh = windSpeedMs * 3.6;

  // Normalized factors in [0,1].
  const heatNorm = clamp01((temp - 10) / 25); // starts at 10 C, saturates near 35 C
  const drynessNorm = clamp01((55 - humidity) / 45); // starts below 55% RH
  const windNorm = clamp01((windSpeedKmh - 5) / 30); // starts above 5 km/h

  // Dryness contribution is gated by heat/wind, preventing humidity-only inflation.
  const effectiveDryness =
    drynessNorm * (0.3 + 0.7 * Math.max(heatNorm, windNorm));

  const tempFactor = heatNorm * 40;
  const humidityFactor = effectiveDryness * 35;
  const windFactor = windNorm * 25;

  // Interaction terms capture compounding behavior.
  const synergy =
    20 * effectiveDryness * heatNorm +
    15 * effectiveDryness * windNorm +
    10 * heatNorm * windNorm;

  const index = Math.round(clamp(tempFactor + humidityFactor + windFactor + synergy, 0, 100));

  let level: FireDangerResult["level"];
  let description: string;
  const conditions: string[] = [];

  if (index < 20) {
    level = "low";
    description = "Low fire danger";
  } else if (index < 40) {
    level = "moderate";
    description = "Moderate fire danger";
  } else if (index < 60) {
    level = "high";
    description = "High fire danger";
  } else if (index < 80) {
    level = "very_high";
    description = "Very high fire danger";
  } else {
    level = "extreme";
    description = "Extreme fire danger";
  }

  if (temp > 30) conditions.push(`Hot (${temp.toFixed(1)} C)`);
  if (humidity < 30) conditions.push(`Very dry (${humidity.toFixed(0)}% humidity)`);
  if (windSpeedKmh > 25) conditions.push(`Strong wind (${windSpeedKmh.toFixed(1)} km/h)`);

  if (temp < 10) conditions.push(`Cool (${temp.toFixed(1)} C)`);
  if (humidity > 70) conditions.push(`Moist (${humidity.toFixed(0)}% humidity)`);
  if (windSpeedKmh < 5) conditions.push(`Calm (${windSpeedKmh.toFixed(1)} km/h)`);

  return {
    index,
    level,
    description,
    conditions: conditions.length > 0 ? conditions : ["Moderate conditions"],
  };
}

export function getFireDangerColor(level: FireDangerResult["level"]): string {
  switch (level) {
    case "low":
      return "bg-green-100 text-green-900 border-green-300";
    case "moderate":
      return "bg-yellow-100 text-yellow-900 border-yellow-300";
    case "high":
      return "bg-orange-100 text-orange-900 border-orange-300";
    case "very_high":
      return "bg-red-100 text-red-900 border-red-300";
    case "extreme":
      return "bg-red-900 text-white border-red-700";
  }
}

/**
 * Risk bar percentage should directly reflect the computed index.
 */
export function getRiskPercentage(index: number): number {
  if (!Number.isFinite(index)) {
    return 0;
  }
  return clamp(Math.round(index), 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
