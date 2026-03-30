/**
 * Estimated FWI Calculator
 * 
 * Calculates an FWI-like score using:
 * - Real sensor data (temperature, humidity, wind)
 * - Estimated/default values for missing components
 * - Simplified FWI algorithm
 * 
 * Official FWI requires:
 * - 16+ days of historical weather data
 * - Precipitation data (not available)
 * - Complex multi-step calculations
 * - Specific to region and season
 * 
 * This is a PROTOTYPE that estimates what the FWI might be
 * using publicly available data and reasonable assumptions.
 */

export interface SensorData {
  bme_temp: number | null;
  bme_hum: number | null;
  anemometer: number | null;
}

export interface EstimatedFWI {
  fwiScore: number; // 0-100+ (like official FWI)
  ffmc: number; // Fine Fuel Moisture Code
  dmc: number; // Duff Moisture Code
  dc: number; // Drought Code
  isi: number; // Initial Spread Index
  bui: number; // Buildup Index
  rating: "low" | "moderate" | "high" | "extreme";
  confidence: number; // 0-100, how confident we are in the estimate
}

/**
 * Convert Kelvin to Celsius
 */
function kelvinToCelsius(k: number): number {
  return k - 273.15;
}

/**
 * Estimate FFMC (Fine Fuel Moisture Code)
 * Based on temperature, humidity, and wind
 * Range: 0-101, higher = drier/more flammable
 */
function estimateFFMC(temp: number, humidity: number, windKmh: number): number {
  // Base FFMC from moisture content
  // Higher temp and lower humidity = higher FFMC
  let ffmc = 50; // Starting point

  // Temperature contribution (max +30)
  if (temp > 20) {
    ffmc += Math.min(30, (temp - 20) * 1.5);
  }

  // Humidity contribution (max -40)
  if (humidity < 60) {
    ffmc -= (60 - humidity) * 0.67;
  }

  // Wind contribution (max +15)
  if (windKmh > 10) {
    ffmc += Math.min(15, (windKmh - 10) * 0.5);
  }

  return Math.max(0, Math.min(101, ffmc));
}

/**
 * Estimate DMC (Duff Moisture Code)
 * Represents moisture layering in loose forest debris
 * Range: 0-300, higher = drier
 */
function estimateDMC(temp: number, humidity: number, dayOfYear: number = 88): number {
  let dmc = 50; // Default mid-range

  // Temperature effect
  if (temp > 15) {
    dmc += (temp - 15) * 1.2;
  }

  // Humidity effect (inverse)
  dmc -= (humidity / 100) * 30;

  // Seasonal effect (higher in summer)
  const seasonalFactor = Math.sin((dayOfYear / 365) * Math.PI) * 40;
  dmc += seasonalFactor;

  return Math.max(0, Math.min(300, dmc));
}

/**
 * Estimate DC (Drought Code)
 * Long-term drought effect on deep organic matter
 * Range: 0-1000, higher = longer drought
 */
function estimateDC(
  temp: number,
  humidity: number,
  dayOfYear: number = 88
): number {
  let dc = 80; // Moderate starting value

  // Temperature effect (major factor)
  if (temp > 17) {
    dc += (temp - 17) * 2.0;
  }

  // Humidity effect (inverse)
  dc -= (humidity / 100) * 50;

  // Seasonal effect (much stronger for DC)
  const seasonalFactor = Math.sin((dayOfYear / 365) * Math.PI) * 100;
  dc += seasonalFactor;

  return Math.max(0, Math.min(1000, dc));
}

/**
 * Estimate ISI (Initial Spread Index)
 * Potential for fire spread
 * Range: 0-300
 */
function estimateISI(windKmh: number, ffmc: number): number {
  let isi = 0;

  // Wind is primary driver
  if (windKmh > 5) {
    isi += (windKmh - 5) * 1.2;
  }

  // Fine fuel moisture code effect
  if (ffmc > 60) {
    isi += (ffmc - 60) * 0.5;
  }

  return Math.max(0, Math.min(300, isi));
}

/**
 * Estimate BUI (Buildup Index)
 * Combination of DMC and DC
 * Range: 0-300
 */
function estimateBUI(dmc: number, dc: number): number {
  // Simple combination
  return Math.max(0, Math.min(300, (dmc + dc) / 2));
}

/**
 * Calculate FWI (Final FWI Index)
 * Combines ISI and BUI
 * Range: 0-100+ (most values 0-50)
 */
function calculateFWI(isi: number, bui: number): number {
  // Official FWI formula (simplified)
  const fwiIntermediate = 0.1 * isi * bui;

  // Normalize to 0-100 scale (most values fall here)
  // Values above 50 are very dangerous
  let fwi = Math.sqrt(fwiIntermediate / 1000) * 100;

  return Math.round(fwi * 10) / 10; // Round to 1 decimal
}

/**
 * Get FWI rating description
 */
function getFWIRating(fwi: number): EstimatedFWI["rating"] {
  if (fwi < 10) return "low";
  if (fwi < 25) return "moderate";
  if (fwi < 50) return "high";
  return "extreme";
}

/**
 * Calculate estimated FWI using sensor data and defaults
 */
export function calculateEstimatedFWI(sensors: SensorData): EstimatedFWI {
  // Check if we have data
  if (sensors.bme_temp === null || sensors.bme_hum === null || sensors.anemometer === null) {
    return {
      fwiScore: 0,
      ffmc: 0,
      dmc: 0,
      dc: 0,
      isi: 0,
      bui: 0,
      rating: "low",
      confidence: 0
    };
  }

  const temp = sensors.bme_temp;
  const humidity = sensors.bme_hum;
  const windMs = sensors.anemometer;
  const windKmh = windMs * 3.6;

  // Get day of year (for seasonal estimates)
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (24 * 60 * 60 * 1000));

  // Calculate each component
  const ffmc = estimateFFMC(temp, humidity, windKmh);
  const dmc = estimateDMC(temp, humidity, dayOfYear);
  const dc = estimateDC(temp, humidity, dayOfYear);
  const isi = estimateISI(windKmh, ffmc);
  const bui = estimateBUI(dmc, dc);
  const fwiScore = calculateFWI(isi, bui);

  // Confidence level based on data availability
  // 80% confidence since we have real sensor data for 3 components
  // Missing: historical data, precipitation, precise daily measurements
  const confidence = 75;

  return {
    fwiScore,
    ffmc: Math.round(ffmc),
    dmc: Math.round(dmc),
    dc: Math.round(dc),
    isi: Math.round(isi),
    bui: Math.round(bui),
    rating: getFWIRating(fwiScore),
    confidence
  };
}

/**
 * Get color for FWI rating
 */
export function getFWIColor(rating: EstimatedFWI["rating"]): string {
  switch (rating) {
    case "low":
      return "bg-green-100 text-green-900 border-green-300";
    case "moderate":
      return "bg-yellow-100 text-yellow-900 border-yellow-300";
    case "high":
      return "bg-orange-100 text-orange-900 border-orange-300";
    case "extreme":
      return "bg-red-100 text-red-900 border-red-300";
  }
}

/**
 * Get FWI description
 */
export function getFWIDescription(rating: EstimatedFWI["rating"]): string {
  switch (rating) {
    case "low":
      return "Low Fire Danger";
    case "moderate":
      return "Moderate Fire Danger";
    case "high":
      return "High Fire Danger";
    case "extreme":
      return "Extreme Fire Danger";
  }
}
