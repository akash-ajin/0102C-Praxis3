import cors from "cors";
import express from "express";
import { z } from "zod";

const BRIDGE_BASE_URL = process.env.BRIDGE_BASE_URL ?? "http://127.0.0.1:5175";
const WEATHER_BASE_URL =
  process.env.WUI_WEATHER_BASE_URL ?? "https://api.open-meteo.com/v1/forecast";
const WEATHER_LAT = parseNumber(process.env.WUI_WEATHER_LAT, 58.7028);
const WEATHER_LON = parseNumber(process.env.WUI_WEATHER_LON, -111.1494);
const WEATHER_TIMEZONE = process.env.WUI_WEATHER_TIMEZONE ?? "America/Edmonton";
const WEATHER_CACHE_MS = parseInteger(
  process.env.WUI_WEATHER_CACHE_MS,
  10 * 60 * 1000
);
const WEATHER_TIMEOUT_MS = parseInteger(
  process.env.WUI_WEATHER_TIMEOUT_MS,
  4000
);
const REGION_NAME = process.env.WUI_REGION_NAME ?? "Chipewyan Lake, AB";
const OFFICIAL_FWI_DEFAULT_LAT = parseNumber(
  process.env.WUI_OFFICIAL_FWI_LAT,
  43.806
);
const OFFICIAL_FWI_DEFAULT_LON = parseNumber(
  process.env.WUI_OFFICIAL_FWI_LON,
  -79.167
);
const OFFICIAL_FWI_DEFAULT_LABEL =
  process.env.WUI_OFFICIAL_FWI_LABEL ?? "Scarborough / Rouge National Urban Park";
const CWFIS_WFS_URL =
  process.env.WUI_CWFIS_WFS_URL ??
  "https://cwfis.cfs.nrcan.gc.ca/geoserver/wfs";
const OFFICIAL_TIMEOUT_MS = parseInteger(
  process.env.WUI_OFFICIAL_FWI_TIMEOUT_MS,
  7000
);

type WeatherDataSource = "live" | "fallback";

interface PrecipitationContext {
  precipitation24hMm: number | null;
  precipitation7dMm: number | null;
  source: WeatherDataSource;
}

interface OfficialStationReading {
  name: string;
  province: string;
  lat: number;
  lon: number;
  reportedAt: string | null;
  fwi: number | null;
  ffmc: number | null;
  dmc: number | null;
  dc: number | null;
  isi: number | null;
  bui: number | null;
  distanceKm: number;
}

const CANADIAN_PROVINCE_CODES = new Set([
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NF",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
  "YK",
]);

const NullableNumberSchema = z.number().nullable();
const SensorSnapshotSchema = z
  .object({
    bme_temp: NullableNumberSchema.optional(),
    am_temp: NullableNumberSchema.optional(),
    bme_hum: NullableNumberSchema.optional(),
    am_hum: NullableNumberSchema.optional(),
    anemometer: NullableNumberSchema.optional(),
    encoder: NullableNumberSchema.optional(),
  })
  .passthrough();

const BridgeSensorsSchema = z.object({
  sensors: SensorSnapshotSchema.optional(),
  latest: SensorSnapshotSchema.optional(),
});

const OpenMeteoResponseSchema = z.object({
  hourly: z
    .object({
      precipitation: z.array(z.number().nullable()).optional(),
    })
    .optional(),
  daily: z
    .object({
      precipitation_sum: z.array(z.number().nullable()).optional(),
    })
    .optional(),
});

const CwfisStationFeatureSchema = z.object({
  properties: z.object({
    name: z.string().nullable().optional(),
    prov: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    lon: z.number().nullable().optional(),
    rep_date: z.string().nullable().optional(),
    fwi: z.number().nullable().optional(),
    ffmc: z.number().nullable().optional(),
    dmc: z.number().nullable().optional(),
    dc: z.number().nullable().optional(),
    isi: z.number().nullable().optional(),
    bui: z.number().nullable().optional(),
  }),
});

const CwfisStationCollectionSchema = z.object({
  features: z.array(CwfisStationFeatureSchema),
});

const app = express();
let cachedPrecipitation: { data: PrecipitationContext; fetchedAtMs: number } | null =
  null;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const FwiResponseSchema = z.object({
  region: z.string(),
  fwi: z.number().nullable(),
  ffmc: z.number().nullable(),
  dmc: z.number().nullable(),
  dc: z.number().nullable(),
  isi: z.number().nullable(),
  bui: z.number().nullable(),
  rating: z.enum(["low", "moderate", "high", "extreme"]),
  confidence: z.number(),
  weatherDataSource: z.enum(["live", "fallback"]),
  precipitation24hMm: z.number().nullable(),
  precipitation7dMm: z.number().nullable(),
  sourceType: z.enum(["official_cwfis_station", "official_unavailable", "estimated_local"]),
  targetLabel: z.string().nullable(),
  targetLat: z.number().nullable(),
  targetLon: z.number().nullable(),
  stationName: z.string().nullable(),
  stationProvince: z.string().nullable(),
  stationDistanceKm: z.number().nullable(),
  stationReportedAt: z.string().nullable(),
  note: z.string().nullable(),
  updatedAt: z.string(),
  dataAvailable: z.boolean(),
});

app.get("/api/fwi/current", async (req, res) => {
  try {
    const queryLat =
      req.query.lat !== undefined ? parseNumber(String(req.query.lat), OFFICIAL_FWI_DEFAULT_LAT) : OFFICIAL_FWI_DEFAULT_LAT;
    const queryLon =
      req.query.lon !== undefined ? parseNumber(String(req.query.lon), OFFICIAL_FWI_DEFAULT_LON) : OFFICIAL_FWI_DEFAULT_LON;
    const targetLabel =
      req.query.label !== undefined && String(req.query.label).trim().length > 0
        ? String(req.query.label).trim()
        : OFFICIAL_FWI_DEFAULT_LABEL;

    const official = await fetchOfficialFwiNear(queryLat, queryLon);
    const updatedAt = new Date().toISOString();

    if (official) {
      const payload: z.infer<typeof FwiResponseSchema> = {
        region: `${targetLabel} (nearest official station: ${official.name.trim()})`,
        fwi: official.fwi,
        ffmc: official.ffmc,
        dmc: official.dmc,
        dc: official.dc,
        isi: official.isi,
        bui: official.bui,
        rating: ratingFromFwi(official.fwi),
        confidence: confidenceFromDistanceKm(official.distanceKm),
        weatherDataSource: "live",
        precipitation24hMm: null,
        precipitation7dMm: null,
        sourceType: "official_cwfis_station",
        targetLabel,
        targetLat: queryLat,
        targetLon: queryLon,
        stationName: official.name.trim(),
        stationProvince: official.province,
        stationDistanceKm: roundTo(official.distanceKm, 1),
        stationReportedAt: official.reportedAt,
        note:
          official.distanceKm > 80
            ? "Closest official station with non-null FWI is not in the immediate Toronto core."
            : null,
        updatedAt,
        dataAvailable: true,
      };

      res.json(payload);
      return;
    }

    const nearestAny = await fetchNearestStation(queryLat, queryLon);
    const payload: z.infer<typeof FwiResponseSchema> = {
      region: targetLabel,
      fwi: null,
      ffmc: null,
      dmc: null,
      dc: null,
      isi: null,
      bui: null,
      rating: "low",
      confidence: 0,
      weatherDataSource: "live",
      precipitation24hMm: null,
      precipitation7dMm: null,
      sourceType: "official_unavailable",
      targetLabel,
      targetLat: queryLat,
      targetLon: queryLon,
      stationName: nearestAny?.name.trim() ?? null,
      stationProvince: nearestAny?.province ?? null,
      stationDistanceKm: nearestAny ? roundTo(nearestAny.distanceKm, 1) : null,
      stationReportedAt: nearestAny?.reportedAt ?? null,
      note:
        "Official CWFIS station data is available, but local stations currently report null FWI for this area/day (often off-season or pre-startup).",
      updatedAt,
      dataAvailable: false,
    };
    res.json(payload);
  } catch (err) {
    console.error("[Server] Failed to fetch official CWFIS FWI:", err);
    res.status(503).json({
      error: "Cannot fetch official FWI",
      hint: "Check internet connectivity or CWFIS service availability.",
    });
  }
});

/**
 * Calculate a simplified FWI-like score
 * Uses temperature, humidity, and wind
 * Real FWI would require 16+ days of historical data
 */
function calculateSimpleFWI(
  input: {
    temp: number;
    humidity: number;
    windMs: number;
    precipitation24hMm: number | null;
    precipitation7dMm: number | null;
    weatherDataSource: WeatherDataSource;
  }
): {
  fwi: number;
  ffmc: number;
  dmc: number;
  dc: number;
  isi: number;
  bui: number;
  rating: "low" | "moderate" | "high" | "extreme";
  confidence: number;
} {
  const { temp, humidity, windMs, precipitation24hMm, precipitation7dMm } = input;
  const windKmh = windMs * 3.6;
  const rain24h = Math.max(0, precipitation24hMm ?? 0);
  const rain7d = Math.max(rain24h, precipitation7dMm ?? rain24h);
  const dayOfYear = Math.floor(
    (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      (24 * 60 * 60 * 1000)
  );

  // Estimate components based on current conditions
  // These are simplified approximations

  // FFMC (Fine Fuel Moisture Code): 0-101
  // Higher = drier/more flammable
  let ffmc = 50;
  if (temp > 20) ffmc += Math.min(30, (temp - 20) * 1.5);
  if (humidity < 60) ffmc -= (60 - humidity) * 0.67;
  if (windKmh > 10) ffmc += Math.min(15, (windKmh - 10) * 0.5);
  ffmc -= Math.min(35, rain24h * 3.5);
  ffmc = Math.max(0, Math.min(101, ffmc));

  // DMC (Duff Moisture Code): 0-300
  let dmc = 50;
  if (temp > 15) dmc += (temp - 15) * 1.2;
  dmc -= (humidity / 100) * 30;
  const seasonalDMC = Math.sin((dayOfYear / 365) * Math.PI) * 40;
  dmc += seasonalDMC;
  dmc -= Math.min(100, rain7d * 2.2);
  dmc = Math.max(0, Math.min(300, dmc));

  // DC (Drought Code): 0-1000
  let dc = 80;
  if (temp > 17) dc += (temp - 17) * 2.0;
  dc -= (humidity / 100) * 50;
  const seasonalDC = Math.sin((dayOfYear / 365) * Math.PI) * 100;
  dc += seasonalDC;
  dc -= Math.min(220, rain7d * 2.5 + rain24h * 1.5);
  dc = Math.max(0, Math.min(1000, dc));

  // ISI (Initial Spread Index): 0-300
  let isi = 0;
  if (windKmh > 5) isi += (windKmh - 5) * 1.2;
  if (ffmc > 60) isi += (ffmc - 60) * 0.5;
  if (rain24h > 0) {
    const rainSuppression = Math.min(0.6, rain24h / 20);
    isi *= 1 - rainSuppression;
  }
  isi = Math.max(0, Math.min(300, isi));

  // BUI (Buildup Index): 0-300
  const bui = Math.max(0, Math.min(300, (dmc + dc) / 2));

  // FWI (Final Index)
  const fwiIntermediate = 0.1 * isi * bui;
  const fwi = Math.sqrt(Math.max(0, fwiIntermediate / 1000)) * 100;

  // Determine rating
  let rating: "low" | "moderate" | "high" | "extreme" = "low";
  if (fwi >= 25) rating = "extreme";
  else if (fwi >= 15) rating = "high";
  else if (fwi >= 5) rating = "moderate";

  let confidence = 75;
  if (input.weatherDataSource === "live") {
    confidence += 7;
  } else {
    confidence -= 8;
  }
  confidence = Math.max(40, Math.min(90, confidence));

  return {
    fwi: Math.round(fwi * 10) / 10,
    ffmc: Math.round(ffmc),
    dmc: Math.round(dmc),
    dc: Math.round(dc),
    isi: Math.round(isi),
    bui: Math.round(bui),
    rating,
    confidence: Math.round(confidence),
  };
}

app.post("/api/fwi/upload-csv", (_req, res) => {
  // TODO: accept CSV file + parse columns (TBD) and compute indices.
  res.status(501).json({
    error: "Not implemented yet",
    hint: "CSV ingest + Canadian FWI calculation will be added once columns are finalized."
  });
});

/**
 * GET /api/sensors
 * Proxies to the Python serial bridge running on port 5175.
 * Returns live sensor readings from Pico 3 receiver.
 */
app.get("/api/sensors", async (_req, res) => {
  try {
    const bridgeResponse = await fetch(`${BRIDGE_BASE_URL}/api/sensors`);
    if (!bridgeResponse.ok) {
      throw new Error(`Bridge returned ${bridgeResponse.status}`);
    }
    const data = await bridgeResponse.json();
    res.json(data);
  } catch (err) {
    console.error("[Server] Failed to fetch from bridge:", err);
    res.status(503).json({
      error: "Bridge unavailable",
      hint: "Start the Python bridge: python pico_serial_bridge.py"
    });
  }
});

/**
 * GET /api/sensors/raw
 * Proxies to the Python serial bridge - returns last raw code for debugging.
 */
app.get("/api/sensors/raw", async (_req, res) => {
  try {
    const bridgeResponse = await fetch(`${BRIDGE_BASE_URL}/api/sensors/raw`);
    if (!bridgeResponse.ok) {
      throw new Error(`Bridge returned ${bridgeResponse.status}`);
    }
    const data = await bridgeResponse.json();
    res.json(data);
  } catch (err) {
    console.error("[Server] Failed to fetch raw from bridge:", err);
    res.status(503).json({
      error: "Bridge unavailable",
      hint: "Start the Python bridge: python pico_serial_bridge.py"
    });
  }
});

const port = Number(process.env.PORT ?? 5174);

app.listen(port, () => {
  console.log(`[Server] Backend listening on http://localhost:${port}`);
  console.log(`[Server] Note: Sensor endpoints will proxy to Python bridge on port 5175`);
});

async function fetchBridgeSensors(): Promise<z.infer<typeof SensorSnapshotSchema>> {
  const sensorsResponse = await fetch(`${BRIDGE_BASE_URL}/api/sensors`);
  if (!sensorsResponse.ok) {
    throw new Error(`Sensors bridge returned ${sensorsResponse.status}`);
  }

  const sensorsDataUnknown = (await sensorsResponse.json()) as unknown;
  const parsed = BridgeSensorsSchema.safeParse(sensorsDataUnknown);
  if (!parsed.success) {
    throw new Error("Sensors bridge payload is not valid JSON shape");
  }

  const snapshot = parsed.data.sensors ?? parsed.data.latest;
  if (!snapshot) {
    throw new Error("Sensors bridge payload missing both sensors and latest");
  }

  return snapshot;
}

async function getPrecipitationContext(): Promise<PrecipitationContext> {
  const now = Date.now();
  if (cachedPrecipitation && now - cachedPrecipitation.fetchedAtMs < WEATHER_CACHE_MS) {
    return cachedPrecipitation.data;
  }

  const freshData = await fetchPrecipitationContext();
  cachedPrecipitation = { data: freshData, fetchedAtMs: now };
  return freshData;
}

async function fetchPrecipitationContext(): Promise<PrecipitationContext> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);

  try {
    const url = new URL(WEATHER_BASE_URL);
    url.searchParams.set("latitude", WEATHER_LAT.toString());
    url.searchParams.set("longitude", WEATHER_LON.toString());
    url.searchParams.set("hourly", "precipitation");
    url.searchParams.set("daily", "precipitation_sum");
    url.searchParams.set("past_days", "7");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", WEATHER_TIMEZONE);

    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    const weatherUnknown = (await response.json()) as unknown;
    const parsed = OpenMeteoResponseSchema.safeParse(weatherUnknown);
    if (!parsed.success) {
      throw new Error("Weather API payload did not match expected schema");
    }

    const precipitation24hMm = sumLastValues(
      parsed.data.hourly?.precipitation ?? [],
      24
    );
    const precipitation7dMm = sumLastValues(
      parsed.data.daily?.precipitation_sum ?? [],
      7
    );

    return {
      precipitation24hMm,
      precipitation7dMm,
      source: "live",
    };
  } catch (err) {
    console.warn("[Server] Weather precipitation unavailable:", err);
    return {
      precipitation24hMm: null,
      precipitation7dMm: null,
      source: "fallback",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchOfficialFwiNear(
  lat: number,
  lon: number
): Promise<OfficialStationReading | null> {
  const searchRadiiKm = [60, 120, 220, 360];

  for (const radiusKm of searchRadiiKm) {
    const stations = await fetchStationsInBbox(lat, lon, radiusKm);
    const withFwi = stations.filter((station) => station.fwi !== null);
    if (withFwi.length > 0) {
      withFwi.sort((a, b) => a.distanceKm - b.distanceKm);
      return withFwi[0] ?? null;
    }
  }

  return null;
}

async function fetchNearestStation(
  lat: number,
  lon: number
): Promise<OfficialStationReading | null> {
  const stations = await fetchStationsInBbox(lat, lon, 120);
  if (stations.length === 0) {
    return null;
  }
  stations.sort((a, b) => a.distanceKm - b.distanceKm);
  return stations[0] ?? null;
}

async function fetchStationsInBbox(
  centerLat: number,
  centerLon: number,
  radiusKm: number
): Promise<OfficialStationReading[]> {
  const bbox = bboxFromRadiusKm(centerLat, centerLon, radiusKm);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OFFICIAL_TIMEOUT_MS);

  try {
    const url = new URL(CWFIS_WFS_URL);
    url.searchParams.set("service", "WFS");
    url.searchParams.set("version", "2.0.0");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("typeNames", "public:firewx_stns_current");
    url.searchParams.set("srsName", "EPSG:4326");
    url.searchParams.set(
      "bbox",
      `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat},EPSG:4326`
    );
    url.searchParams.set("count", "500");
    url.searchParams.set("outputFormat", "application/json");

    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`CWFIS WFS returned ${response.status}`);
    }

    const unknownPayload = (await response.json()) as unknown;
    const parsed = CwfisStationCollectionSchema.safeParse(unknownPayload);
    if (!parsed.success) {
      throw new Error("CWFIS station payload failed schema validation");
    }

    const rows: OfficialStationReading[] = [];
    for (const feature of parsed.data.features) {
      const name = feature.properties.name?.trim();
      const province = feature.properties.prov?.trim();
      const stationLat = feature.properties.lat;
      const stationLon = feature.properties.lon;

      if (!name || !province) {
        continue;
      }
      if (!CANADIAN_PROVINCE_CODES.has(province)) {
        continue;
      }
      if (!isFiniteNumber(stationLat) || !isFiniteNumber(stationLon)) {
        continue;
      }

      rows.push({
        name,
        province,
        lat: stationLat,
        lon: stationLon,
        reportedAt: feature.properties.rep_date ?? null,
        fwi: normalizeNullableNumber(feature.properties.fwi),
        ffmc: normalizeNullableNumber(feature.properties.ffmc),
        dmc: normalizeNullableNumber(feature.properties.dmc),
        dc: normalizeNullableNumber(feature.properties.dc),
        isi: normalizeNullableNumber(feature.properties.isi),
        bui: normalizeNullableNumber(feature.properties.bui),
        distanceKm: haversineDistanceKm(centerLat, centerLon, stationLat, stationLon),
      });
    }

    return rows;
  } finally {
    clearTimeout(timeoutId);
  }
}

function ratingFromFwi(value: number | null): "low" | "moderate" | "high" | "extreme" {
  if (value === null || !Number.isFinite(value)) {
    return "low";
  }
  if (value >= 25) return "extreme";
  if (value >= 15) return "high";
  if (value >= 5) return "moderate";
  return "low";
}

function confidenceFromDistanceKm(distanceKm: number): number {
  const confidence = 95 - distanceKm * 0.2;
  return Math.round(clamp(confidence, 45, 95));
}

function bboxFromRadiusKm(lat: number, lon: number, radiusKm: number): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  const deltaLat = radiusKm / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const safeCosLat = Math.max(0.15, Math.abs(cosLat));
  const deltaLon = radiusKm / (111.32 * safeCosLat);

  return {
    minLat: lat - deltaLat,
    maxLat: lat + deltaLat,
    minLon: lon - deltaLon,
    maxLon: lon + deltaLon,
  };
}

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeNullableNumber(value: number | null | undefined): number | null {
  return isFiniteNumber(value) ? value : null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function averageAvailable(values: Array<number | null | undefined>): number | null {
  const validValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (validValues.length === 0) {
    return null;
  }

  const sum = validValues.reduce((accumulator, value) => accumulator + value, 0);
  return sum / validValues.length;
}

function sumLastValues(values: Array<number | null>, count: number): number | null {
  const recentValues = values.slice(-count).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (recentValues.length === 0) {
    return null;
  }

  const sum = recentValues.reduce((accumulator, value) => accumulator + value, 0);
  return Math.round(sum * 10) / 10;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

