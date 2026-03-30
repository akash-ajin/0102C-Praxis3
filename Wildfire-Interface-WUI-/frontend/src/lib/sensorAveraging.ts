/**
 * Sensor Averaging & Disagreement Detection
 * 
 * Combines dual sensor readings (BME680 vs AM2320) with
 * automatic disagreement detection to flag sensor issues.
 */

export interface AveragedData {
  temperature: number | null;
  humidity: number | null;
  tempDisagreement: boolean;
  humidityDisagreement: boolean;
  tempDifference: number;
  humidityDifference: number;
}

/**
 * Calculate average temperature from BME680 and AM2320
 * Flags if readings differ by more than threshold
 * @param bmeTemp BME680 temperature (°C)
 * @param amTemp AM2320 temperature (°C)
 * @param threshold Maximum allowed difference (default 3°C)
 */
export function averageTemperature(
  bmeTemp: number | null,
  amTemp: number | null,
  threshold: number = 3.0
): { avg: number | null; disagreement: boolean; difference: number } {
  if (bmeTemp === null && amTemp === null) {
    return { avg: null, disagreement: false, difference: 0 };
  }

  if (bmeTemp === null) return { avg: amTemp, disagreement: false, difference: 0 };
  if (amTemp === null) return { avg: bmeTemp, disagreement: false, difference: 0 };

  const difference = Math.abs(bmeTemp - amTemp);
  const disagreement = difference > threshold;
  const avg = (bmeTemp + amTemp) / 2;

  return { avg, disagreement, difference };
}

/**
 * Calculate average humidity from BME680 and AM2320
 * Flags if readings differ by more than threshold
 * @param bmeHum BME680 humidity (%)
 * @param amHum AM2320 humidity (%)
 * @param threshold Maximum allowed difference (default 10%)
 */
export function averageHumidity(
  bmeHum: number | null,
  amHum: number | null,
  threshold: number = 10.0
): { avg: number | null; disagreement: boolean; difference: number } {
  if (bmeHum === null && amHum === null) {
    return { avg: null, disagreement: false, difference: 0 };
  }

  if (bmeHum === null) return { avg: amHum, disagreement: false, difference: 0 };
  if (amHum === null) return { avg: bmeHum, disagreement: false, difference: 0 };

  const difference = Math.abs(bmeHum - amHum);
  const disagreement = difference > threshold;
  const avg = (bmeHum + amHum) / 2;

  return { avg, disagreement, difference };
}

/**
 * Get averaged sensor data with disagreement detection
 */
export function getAveragedData(sensors: {
  bme_temp: number | null;
  am_temp: number | null;
  bme_hum: number | null;
  am_hum: number | null;
}): AveragedData {
  const tempResult = averageTemperature(sensors.bme_temp, sensors.am_temp);
  const humResult = averageHumidity(sensors.bme_hum, sensors.am_hum);

  return {
    temperature: tempResult.avg,
    humidity: humResult.avg,
    tempDisagreement: tempResult.disagreement,
    humidityDisagreement: humResult.disagreement,
    tempDifference: tempResult.difference,
    humidityDifference: humResult.difference,
  };
}

/**
 * Get sensor disagreement status message
 */
export function getDisagreementMessage(data: AveragedData): string | null {
  const messages: string[] = [];

  if (data.tempDisagreement) {
    messages.push(
      `Temperature sensors disagree by ${data.tempDifference.toFixed(1)}°C`
    );
  }

  if (data.humidityDisagreement) {
    messages.push(
      `Humidity sensors disagree by ${data.humidityDifference.toFixed(1)}%`
    );
  }

  if (messages.length === 0) return null;
  return messages.join(" | ");
}
