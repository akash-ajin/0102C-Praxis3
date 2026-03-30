import { useEffect, useMemo, useState } from "react";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { FireDangerPanel } from "../components/FireDangerPanel";
import { WindDirectionMap } from "../components/WindDirectionMap";
import { fetchCurrentFwi } from "../lib/api";
import type { SensorData } from "../lib/fireDangerCalculator";
import { getSoilMoistureStatus } from "../lib/soilMoisture";
import type { FwiCurrentResponse, SensorApiResponse, SensorDiagnostics } from "../lib/types";
import { getCompassDirection, normalizeDirectionDegrees } from "../lib/wind";

const SENSOR_REFRESH_MS = 2000;
const FWI_REFRESH_MS = 5000;

export interface ExtendedSensorData extends SensorData {
  am_temp: number | null;
  am_hum: number | null;
  bme_press: number | null;
  bme_gas: number | null;
  encoder: number | null;
  soil: number | null;
}

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

function ratingToSeverity(rating: FwiCurrentResponse["rating"]) {
  if (rating === "extreme") return "critical";
  if (rating === "high") return "advisory";
  if (rating === "moderate" || rating === "low") return "test";
  return "unknown" as const;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number | null, digits: number): string {
  return value === null ? "-" : value.toFixed(digits);
}

export function HomePage() {
  const [fwiData, setFwiData] = useState<FwiCurrentResponse | null>(null);
  const [fwiError, setFwiError] = useState<string | null>(null);
  const [fwiLoading, setFwiLoading] = useState(true);
  const [sensorDiagnostics, setSensorDiagnostics] =
    useState<SensorDiagnostics>(EMPTY_DIAGNOSTICS);

  const [sensors, setSensors] = useState<ExtendedSensorData>({
    bme_temp: null,
    bme_hum: null,
    anemometer: null,
    am_temp: null,
    am_hum: null,
    bme_press: null,
    bme_gas: null,
    encoder: null,
    soil: null,
  });

  useEffect(() => {
    let mounted = true;

    const loadFwi = async (isInitialLoad = false) => {
      if (isInitialLoad) {
        setFwiLoading(true);
      }

      try {
        const data = await fetchCurrentFwi();
        if (!mounted) return;
        setFwiData(data);
        setFwiError(null);
      } catch (err) {
        if (!mounted) return;
        setFwiError(err instanceof Error ? err.message : "Failed to load FWI");
      } finally {
        if (!mounted) return;
        if (isInitialLoad) {
          setFwiLoading(false);
        }
      }
    };

    void loadFwi(true);
    const interval = setInterval(() => {
      void loadFwi();
    }, FWI_REFRESH_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchSensors = async () => {
      try {
        const res = await fetch("/api/sensors");
        const data = (await res.json()) as SensorApiResponse;
        if (!mounted) return;

        const next = data.sensors ?? {};
        setSensors((prev) => ({
          ...prev,
          ...next,
        }));
        if (data.diagnostics) {
          setSensorDiagnostics(data.diagnostics);
        }
      } catch (err) {
        console.error("Failed to fetch sensors:", err);
      }
    };

    void fetchSensors();
    const interval = setInterval(() => {
      void fetchSensors();
    }, SENSOR_REFRESH_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const severity = useMemo(
    () => (fwiData ? ratingToSeverity(fwiData.rating) : "unknown"),
    [fwiData]
  );

  const temp = asNumber(sensors.bme_temp);
  const humidity = asNumber(sensors.bme_hum);
  const windMs = asNumber(sensors.anemometer);
  const soilV = asNumber(sensors.soil);
  const soilStatus = getSoilMoistureStatus(soilV);
  const windDirection = normalizeDirectionDegrees(asNumber(sensors.encoder));
  const windCompass = getCompassDirection(windDirection);
  const invalidRatioPercent = (sensorDiagnostics.recentInvalidRatio * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {sensorDiagnostics.communicationDisruption && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-900">
          <div className="font-semibold">Communications disruption detected</div>
          <div className="mt-1 text-sm">
            Invalid packet rate is {invalidRatioPercent}% in the last{" "}
            {sensorDiagnostics.recentWindowPackets} packets. Check RF link quality,
            Pico receiver alignment, and power stability.
          </div>
          {sensorDiagnostics.lastInvalidCode && (
            <div className="mt-1 text-xs">
              Last invalid packet: {sensorDiagnostics.lastInvalidCode} (
              {sensorDiagnostics.lastInvalidReason ?? "unknown reason"})
            </div>
          )}
        </div>
      )}

      <div>
        <FireDangerPanel sensors={sensors} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-bold">Wind and Weather</h2>
          <WindDirectionMap speedMs={windMs} directionDegrees={windDirection} />
        </div>

        <div>
          <h2 className="mb-4 text-xl font-bold">Live Sensor Data</h2>
          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded bg-blue-50 p-4">
                <p className="text-sm text-gray-600">Temperature</p>
                <p className="text-2xl font-bold">{formatNumber(temp, 1)} C</p>
              </div>
              <div className="rounded bg-green-50 p-4">
                <p className="text-sm text-gray-600">Humidity</p>
                <p className="text-2xl font-bold">{formatNumber(humidity, 0)}%</p>
              </div>
              <div className="rounded bg-yellow-50 p-4">
                <p className="text-sm text-gray-600">Wind Speed</p>
                <p className="text-2xl font-bold">
                  {windMs !== null ? (windMs * 3.6).toFixed(1) : "-"}
                  <span className="ml-1 text-sm text-gray-600">km/h</span>
                </p>
              </div>
              <div className="rounded bg-purple-50 p-4">
                <p className="text-sm text-gray-600">Wind Direction</p>
                <p className="text-2xl font-bold">{windCompass}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {windDirection !== null ? `${windDirection} deg` : "-"}
                </p>
              </div>
            </div>
            <div
              className={`rounded p-3 text-sm ${
                soilStatus.saturated
                  ? "bg-amber-100 text-amber-900"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              Soil moisture:{" "}
              <span className="font-semibold">{soilStatus.label}</span>
              {soilV !== null ? ` (${soilV.toFixed(2)} V)` : ""}
            </div>
            <div className="rounded bg-gray-50 p-3 text-xs text-gray-500">
              Data updates every 2 seconds from Pico sensors.
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Official Fire Weather Index (FWI)"
            subtitle="Nearest official CWFIS station to your selected Toronto-area point"
            right={<Badge severity={severity} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-900/5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Region
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {fwiLoading ? "Loading..." : fwiData?.region ?? "-"}
                </div>
                <div className="mt-1 w-fit rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">
                  Official CWFIS
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-900/5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Official FWI Score (Station)
                </div>
                <div className="mt-1 text-3xl font-bold">
                  {fwiLoading
                    ? "..."
                    : fwiData?.dataAvailable
                      ? fwiData.fwi !== null
                        ? fwiData.fwi.toFixed(1)
                        : "-"
                      : "-"}
                </div>

                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  {!fwiLoading && fwiData?.dataAvailable && (
                    <>
                      <div>FFMC: {fwiData.ffmc} | DMC: {fwiData.dmc} | DC: {fwiData.dc}</div>
                      <div>ISI: {fwiData.isi} | BUI: {fwiData.bui}</div>
                      <div>Station: {fwiData.stationName ?? "-"} ({fwiData.stationProvince ?? "-"})</div>
                      <div>
                        Distance from target:{" "}
                        {fwiData.stationDistanceKm !== null
                          ? `${fwiData.stationDistanceKm.toFixed(1)} km`
                          : "-"}
                      </div>
                      <div>
                        Station report time:{" "}
                        {fwiData.stationReportedAt
                          ? new Date(fwiData.stationReportedAt).toLocaleString()
                          : "-"}
                      </div>
                      <div className="text-blue-600">Confidence: {fwiData.confidence}%</div>
                    </>
                  )}
                  {!fwiLoading && fwiData?.note && (
                    <div className="font-semibold text-amber-700">{fwiData.note}</div>
                  )}
                  {fwiError ? (
                    <span className="font-semibold text-red-700">{fwiError}</span>
                  ) : fwiData?.updatedAt ? (
                    <>Updated {new Date(fwiData.updatedAt).toLocaleString()}</>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
              <div className="text-sm font-semibold">How official value is selected</div>
              <div className="mt-1 text-sm text-slate-600">
                This panel now queries the official NRCan CWFIS online database. It uses
                your Toronto-area target point and selects the nearest Canadian reporting
                station that has a non-null official FWI on the current day.
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Target point: {fwiData?.targetLabel ?? "-"}{" "}
                {fwiData?.targetLat !== null && fwiData?.targetLon !== null
                  ? `(${fwiData?.targetLat?.toFixed(3)}, ${fwiData?.targetLon?.toFixed(3)})`
                  : ""}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card title="Quick actions" subtitle="Prototype UI helpers.">
            <div className="grid gap-3">
              <a
                href="/news"
                className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-sky-700"
              >
                View Neighborhood Wildfire News
              </a>
              <a
                href="/articles"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-900/10 transition hover:bg-slate-50"
              >
                Browse Articles
              </a>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600 ring-1 ring-slate-900/5">
                Real-time fire danger uses Pico sensor data. Official FWI card uses NRCan
                CWFIS online station data.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
