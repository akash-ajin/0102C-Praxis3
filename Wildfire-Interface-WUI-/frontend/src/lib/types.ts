export type AlertSeverity = "critical" | "advisory" | "test";

export type AlertItem = {
  id: string;
  title: string;
  region: string;
  issuedAt: string;
  severity: AlertSeverity;
  description: string;
  safetyInstructions: string[];
};

export type FwiRating = "low" | "moderate" | "high" | "extreme";
export type WeatherDataSource = "live" | "fallback";
export type FwiSourceType =
  | "official_cwfis_station"
  | "official_unavailable"
  | "estimated_local";

export type SensorDiagnostics = {
  totalPackets: number;
  validPackets: number;
  invalidPackets: number;
  recentWindowPackets: number;
  recentInvalidPackets: number;
  recentInvalidRatio: number;
  communicationDisruption: boolean;
  alertMessage: string | null;
  lastInvalidCode: string | null;
  lastInvalidReason: string | null;
  lastInvalidAt: string | null;
  thresholds: {
    minPackets: number;
    invalidRatio: number;
    windowPackets: number;
  };
};

export type SensorSnapshot = {
  bme_temp: number | null;
  bme_hum: number | null;
  bme_press: number | null;
  bme_gas: number | null;
  am_temp: number | null;
  am_hum: number | null;
  encoder: number | null;
  anemometer: number | null;
  soil: number | null;
  [key: string]: number | null;
};

export type SensorApiResponse = {
  sensors: SensorSnapshot;
  lastUpdate: string;
  rawCode: string | null;
  diagnostics?: SensorDiagnostics;
};

export type FwiCurrentResponse = {
  region: string;
  fwi: number | null;
  ffmc: number | null;
  dmc: number | null;
  dc: number | null;
  isi: number | null;
  bui: number | null;
  rating: FwiRating;
  confidence: number;
  weatherDataSource: WeatherDataSource;
  precipitation24hMm: number | null;
  precipitation7dMm: number | null;
  sourceType: FwiSourceType;
  targetLabel: string | null;
  targetLat: number | null;
  targetLon: number | null;
  stationName: string | null;
  stationProvince: string | null;
  stationDistanceKm: number | null;
  stationReportedAt: string | null;
  note: string | null;
  updatedAt: string;
  dataAvailable: boolean;
};

