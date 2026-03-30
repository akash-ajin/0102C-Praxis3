export function normalizeDirectionDegrees(
  rawDirection: number | null | undefined
): number | null {
  if (rawDirection === null || rawDirection === undefined || !Number.isFinite(rawDirection)) {
    return null;
  }

  // Some data paths report encoder ticks in 0-80 instead of degrees.
  if (rawDirection >= 0 && rawDirection <= 80) {
    return Math.round((rawDirection / 80) * 360) % 360;
  }

  // Most data paths already provide degrees. Normalize to 0-359.
  const normalized = ((rawDirection % 360) + 360) % 360;
  return Math.round(normalized);
}

export function getCompassDirection(
  directionDegrees: number | null | undefined
): string {
  if (directionDegrees === null || directionDegrees === undefined) {
    return "N/A";
  }

  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(directionDegrees / 22.5) % 16;
  return directions[index];
}
