export const SOIL_DRY_V = 0.16;
export const SOIL_SAT_V = 3.33;
const SOIL_SAT_EPSILON_V = 0.01;

export type SoilMoistureStatus =
  | {
      state: "no_data";
      percentage: null;
      saturated: false;
      label: "No data";
    }
  | {
      state: "percentage";
      percentage: number;
      saturated: false;
      label: string;
    }
  | {
      state: "saturated";
      percentage: 100;
      saturated: true;
      label: "Saturated";
    };

export function getSoilMoistureStatus(
  soilVoltage: number | null | undefined
): SoilMoistureStatus {
  if (soilVoltage === null || soilVoltage === undefined || !Number.isFinite(soilVoltage)) {
    return {
      state: "no_data",
      percentage: null,
      saturated: false,
      label: "No data",
    };
  }

  if (soilVoltage >= SOIL_SAT_V - SOIL_SAT_EPSILON_V) {
    return {
      state: "saturated",
      percentage: 100,
      saturated: true,
      label: "Saturated",
    };
  }

  const normalized = (soilVoltage - SOIL_DRY_V) / (SOIL_SAT_V - SOIL_DRY_V);
  const percentage = Math.max(0, Math.min(100, normalized * 100));

  return {
    state: "percentage",
    percentage,
    saturated: false,
    label: `${Math.round(percentage)}%`,
  };
}
