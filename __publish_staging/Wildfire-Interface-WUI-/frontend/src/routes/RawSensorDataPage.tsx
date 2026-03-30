import { useEffect, useMemo, useState } from "react";
import type { SensorApiResponse, SensorDiagnostics } from "../lib/types";
import { getSoilMoistureStatus } from "../lib/soilMoisture";
import { getCompassDirection, normalizeDirectionDegrees } from "../lib/wind";

type SensorSnapshot = Record<string, number | null | undefined>;

const EMPTY_DIAGNOSTICS: SensorDiagnostics = {
  totalPackets: 0,
  validPackets: 0,
  invalidPackets: 0,
  recentWindowPackets: 0,
  recentInvalidPackets: 0,
  recentInvalidRatio: 0,
  communicationDisruption: false,
  alertMessage: null,
  lastInvalidCode: null,
  lastInvalidReason: null,
  lastInvalidAt: null,
  thresholds: {
    minPackets: 15,
    invalidRatio: 0.35,
    windowPackets: 40,
  },
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function renderValue(value: number | null, digits = 2): string {
  return value === null ? "-" : value.toFixed(digits);
}

export function RawSensorDataPage() {
  const [sensors, setSensors] = useState<SensorSnapshot>({});
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("-");
  const [diagnostics, setDiagnostics] = useState<SensorDiagnostics>(EMPTY_DIAGNOSTICS);

  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const res = await fetch("/api/sensors");
        if (!res.ok) throw new Error("Failed to fetch sensors");
        const data = (await res.json()) as SensorApiResponse;
        setSensors(data.sensors ?? {});
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
        }
        setLastUpdate(new Date().toLocaleTimeString());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
      }
    };

    void fetchSensors();
    const interval = setInterval(() => {
      void fetchSensors();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const bmeTemp = asNumber(sensors.bme_temp);
  const amTemp = asNumber(sensors.am_temp);
  const bmeHum = asNumber(sensors.bme_hum);
  const amHum = asNumber(sensors.am_hum);
  const pressure = asNumber(sensors.bme_press);
  const gas = asNumber(sensors.bme_gas);
  const anemometer = asNumber(sensors.anemometer);
  const soil = asNumber(sensors.soil);
  const encoder = asNumber(sensors.encoder);
  const soilStatus = getSoilMoistureStatus(soil);

  const windDirectionDegrees = useMemo(
    () => normalizeDirectionDegrees(encoder),
    [encoder]
  );
  const windDirectionCompass = getCompassDirection(windDirectionDegrees);

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Raw Sensor Data</h1>
        <p className="text-slate-600">All decoded sensor readings from Pico 3 receiver</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500 bg-red-100 p-4 text-red-900">
          {error}
        </div>
      )}

      <div
        className={`mb-6 rounded-lg border p-4 ${
          diagnostics.communicationDisruption
            ? "border-amber-400 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900"
        }`}
      >
        <div className="font-semibold">
          {diagnostics.communicationDisruption
            ? "Communications disruption detected"
            : "Communications stable"}
        </div>
        <div className="mt-1 text-sm">
          Invalid packets: {diagnostics.invalidPackets} total,{" "}
          {(diagnostics.recentInvalidRatio * 100).toFixed(1)}% in last{" "}
          {diagnostics.recentWindowPackets} packets.
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">BME680 Temperature</div>
          <div className="text-3xl font-bold text-blue-700">{renderValue(bmeTemp)} C</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">AM2320 Temperature</div>
          <div className="text-3xl font-bold text-blue-700">{renderValue(amTemp)} C</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">BME680 Humidity</div>
          <div className="text-3xl font-bold text-green-700">{renderValue(bmeHum, 1)}%</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">AM2320 Humidity</div>
          <div className="text-3xl font-bold text-green-700">{renderValue(amHum, 1)}%</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Pressure (BME680)</div>
          <div className="text-3xl font-bold text-yellow-700">{renderValue(pressure)} hPa</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Gas Resistance (BME680)</div>
          <div className="text-3xl font-bold text-orange-700">
            {gas !== null ? (gas / 1000).toFixed(0) : "-"} kOhm
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Anemometer (Wind Speed)</div>
          <div>
            <div className="text-3xl font-bold text-purple-700">
              {anemometer !== null ? (anemometer * 3.6).toFixed(1) : "-"} km/h
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {anemometer !== null ? anemometer.toFixed(2) : "-"} m/s
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Soil Moisture</div>
          <div
            className={`text-3xl font-bold ${
              soilStatus.saturated ? "text-amber-800" : "text-amber-700"
            }`}
          >
            {soilStatus.label}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {renderValue(soil)} V
            {soilStatus.percentage !== null && !soilStatus.saturated
              ? ` (${Math.round(soilStatus.percentage)}%)`
              : ""}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Wind Direction (Encoder)</div>
          <div>
            <div className="text-3xl font-bold text-cyan-700">
              {windDirectionDegrees !== null ? `${windDirectionDegrees} deg` : "-"}
            </div>
            <div className="mt-1 text-sm text-slate-500">{windDirectionCompass}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-slate-500">Last Update: </span>
            <span className="font-mono text-slate-900">{lastUpdate}</span>
          </div>
          <div className="text-sm text-slate-500">Updates every 2 seconds</div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Raw JSON</h2>
        <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4">
          <pre className="font-mono text-sm text-slate-300">{JSON.stringify(sensors, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
