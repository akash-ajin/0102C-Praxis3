import { useMemo } from "react";
import {
  calculateFireDangerIndex,
  getFireDangerColor,
  getRiskPercentage,
  type FireDangerResult,
  type SensorData,
} from "../lib/fireDangerCalculator";
import { getAveragedData, getDisagreementMessage } from "../lib/sensorAveraging";
import { getCompassDirection, normalizeDirectionDegrees } from "../lib/wind";

export interface FireDangerPanelProps {
  sensors: SensorData & {
    am_temp?: number | null;
    am_hum?: number | null;
    encoder?: number | null;
  };
}

/**
 * Fire Danger Index Display
 * Shows real-time fire danger based on temperature, humidity, and wind speed.
 * Uses averaged values from dual sensors (BME680 + AM2320) with disagreement warnings.
 */
export function FireDangerPanel({ sensors }: FireDangerPanelProps) {
  const averagedData = useMemo(() => {
    return getAveragedData({
      bme_temp: sensors.bme_temp,
      am_temp: sensors.am_temp ?? null,
      bme_hum: sensors.bme_hum,
      am_hum: sensors.am_hum ?? null,
    });
  }, [sensors]);

  const sensorData = useMemo(
    () => ({
      bme_temp: averagedData.temperature,
      bme_hum: averagedData.humidity,
      anemometer: sensors.anemometer,
    }),
    [averagedData, sensors.anemometer]
  );

  const result: FireDangerResult = useMemo(
    () => calculateFireDangerIndex(sensorData),
    [sensorData]
  );
  const colorClass = getFireDangerColor(result.level);
  const riskPercent = getRiskPercentage(result.index);
  const disagreementMessage = getDisagreementMessage(averagedData);
  const windDirection = useMemo(
    () => normalizeDirectionDegrees(sensors.encoder),
    [sensors.encoder]
  );
  const compassDirection = getCompassDirection(windDirection);

  return (
    <div className={`rounded-lg border-2 p-6 ${colorClass}`}>
      <div className="mb-4">
        <h2 className="mb-2 text-2xl font-bold">Real-Time Fire Danger Index</h2>
        <p className="text-sm opacity-75">
          Based on averaged temperature, humidity, and wind speed
        </p>
      </div>

      {disagreementMessage && (
        <div className="mb-4 rounded border border-yellow-400 bg-yellow-100 p-3 text-yellow-900">
          <span className="font-semibold">Sensor disagreement: </span>
          {disagreementMessage}
        </div>
      )}

      <div className="mb-6">
        <div className="mb-2 text-6xl font-bold">{result.index}</div>
        <div className="text-2xl font-semibold">{result.description}</div>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex justify-between text-sm">
          <span>Risk Level</span>
          <span className="font-semibold">{riskPercent}%</span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-gray-300">
          <div
            className={`h-full bg-gradient-to-r ${
              result.level === "low"
                ? "from-green-500 to-green-600"
                : result.level === "moderate"
                  ? "from-yellow-500 to-yellow-600"
                  : result.level === "high"
                    ? "from-orange-500 to-orange-600"
                    : result.level === "very_high"
                      ? "from-red-500 to-red-600"
                      : "from-red-700 to-red-900"
            }`}
            style={{ width: `${riskPercent}%` }}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded border-l-4 border-blue-500 bg-white bg-opacity-50 p-4">
          <div className="text-xs font-semibold opacity-75">Temperature (Avg)</div>
          <div className="mt-2 text-2xl font-bold">
            {averagedData.temperature !== null ? averagedData.temperature.toFixed(1) : "-"} C
          </div>
          <div className="mt-1 text-xs opacity-60">
            {averagedData.temperature !== null
              ? averagedData.temperature > 30
                ? "Hot"
                : averagedData.temperature > 15
                  ? "Mild"
                  : "Cool"
              : "-"}
          </div>
        </div>

        <div className="rounded border-l-4 border-green-500 bg-white bg-opacity-50 p-4">
          <div className="text-xs font-semibold opacity-75">Humidity (Avg)</div>
          <div className="mt-2 text-2xl font-bold">
            {averagedData.humidity !== null ? averagedData.humidity.toFixed(0) : "-"}%
          </div>
          <div className="mt-1 text-xs opacity-60">
            {averagedData.humidity !== null
              ? averagedData.humidity > 70
                ? "Wet"
                : averagedData.humidity > 40
                  ? "Moderate"
                  : "Dry"
              : "-"}
          </div>
        </div>

        <div className="rounded border-l-4 border-orange-500 bg-white bg-opacity-50 p-4">
          <div className="text-xs font-semibold opacity-75">Wind Speed</div>
          <div className="mt-2 text-2xl font-bold">
            {sensors.anemometer !== null ? (sensors.anemometer * 3.6).toFixed(1) : "-"}
            <span className="ml-1 text-sm">km/h</span>
          </div>
          <div className="mt-1 text-xs opacity-60">
            {sensors.anemometer !== null ? sensors.anemometer.toFixed(2) : "-"} m/s
          </div>
        </div>

        <div className="rounded border-l-4 border-purple-500 bg-white bg-opacity-50 p-4">
          <div className="text-xs font-semibold opacity-75">Wind Direction</div>
          <div className="mt-2 text-2xl font-bold">{compassDirection}</div>
          <div className="mt-1 text-xs opacity-60">
            {windDirection !== null ? `${windDirection} deg` : "-"} ·{" "}
            {sensors.anemometer !== null
              ? sensors.anemometer > 10
                ? "Strong"
                : sensors.anemometer > 5
                  ? "Moderate"
                  : "Light"
              : "-"}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold">Contributing Factors:</p>
        <div className="space-y-1">
          {result.conditions.map((condition, i) => (
            <div
              key={i}
              className="mb-2 mr-2 inline-block rounded bg-white bg-opacity-40 px-3 py-1 text-sm"
            >
              {condition}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t pt-4 text-xs opacity-75">
        <strong>Note:</strong> This is a real-time fire danger estimate, not the official
        Canadian FWI Index. For official FWI ratings, visit{" "}
        <a href="https://cwfis.cfs.nrcan.gc.ca/" className="underline">
          Natural Resources Canada
        </a>
      </div>
    </div>
  );
}
