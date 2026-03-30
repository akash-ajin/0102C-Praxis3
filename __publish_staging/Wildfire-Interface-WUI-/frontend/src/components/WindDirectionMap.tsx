import { getCompassDirection, normalizeDirectionDegrees } from "../lib/wind";

export interface WindData {
  speedMs: number | null;
  directionDegrees?: number | null;
}

function getWindCategory(speedKmh: number) {
  if (speedKmh < 5) return { category: "Calm", color: "text-teal-700" };
  if (speedKmh < 11) return { category: "Light", color: "text-blue-700" };
  if (speedKmh < 19) return { category: "Moderate", color: "text-orange-700" };
  if (speedKmh < 28) return { category: "Fresh", color: "text-red-600" };
  return { category: "Strong", color: "text-red-800" };
}

export function WindDirectionMap({ speedMs, directionDegrees }: WindData) {
  const speedKmh = speedMs !== null ? speedMs * 3.6 : 0;
  const windInfo = getWindCategory(speedKmh);
  const normalizedDirection = normalizeDirectionDegrees(directionDegrees);
  const compassDirection = getCompassDirection(normalizedDirection);
  const rotation = normalizedDirection ?? 0;

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-blue-200 bg-gradient-to-b from-blue-50 to-blue-100 p-6">
      <h3 className="mb-4 text-lg font-bold text-gray-800">Wind Conditions</h3>

      <div className="relative mb-4 h-40 w-40">
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}
        >
          <circle cx="100" cy="100" r="95" fill="white" stroke="#3b82f6" strokeWidth="2" />

          <text
            x="100"
            y="25"
            textAnchor="middle"
            className="fill-blue-900 text-xs font-bold"
            fontSize="14"
          >
            N
          </text>
          <text
            x="175"
            y="105"
            textAnchor="middle"
            className="fill-blue-900 text-xs font-bold"
            fontSize="14"
          >
            E
          </text>
          <text
            x="100"
            y="185"
            textAnchor="middle"
            className="fill-blue-900 text-xs font-bold"
            fontSize="14"
          >
            S
          </text>
          <text
            x="25"
            y="105"
            textAnchor="middle"
            className="fill-blue-900 text-xs font-bold"
            fontSize="14"
          >
            W
          </text>

          {[45, 135, 225, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x = 100 + 75 * Math.cos(rad);
            const y = 100 + 75 * Math.sin(rad);
            return (
              <text
                key={angle}
                x={x}
                y={y}
                textAnchor="middle"
                className="fill-gray-500 text-xs"
                fontSize="11"
              >
                {angle === 45 ? "NE" : angle === 135 ? "SE" : angle === 225 ? "SW" : "NW"}
              </text>
            );
          })}

          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 100 + 85 * Math.cos(rad);
            const y1 = 100 + 85 * Math.sin(rad);
            const x2 = 100 + 90 * Math.cos(rad);
            const y2 = 100 + 90 * Math.sin(rad);
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#dbeafe"
                strokeWidth="1"
              />
            );
          })}

          <g transform={`rotate(${rotation} 100 100)`}>
            <path
              d="M 100 30 L 110 60 L 105 60 L 105 100 L 95 100 L 95 60 L 90 60 Z"
              fill="#ef4444"
              opacity="0.85"
            />
          </g>

          <circle cx="100" cy="100" r="8" fill="#1f2937" />
        </svg>
      </div>

      <div className="mb-4 text-center">
        <div className="text-2xl font-bold text-gray-800">
          {speedKmh.toFixed(1)}
          <span className="ml-1 text-lg text-gray-600">km/h</span>
        </div>
        <div className="mt-1 text-sm text-gray-600">
          {speedMs !== null ? `${speedMs.toFixed(2)} m/s` : "No speed data"}
        </div>
        <div className={`mt-2 text-lg font-semibold ${windInfo.color}`}>
          {windInfo.category} Wind
        </div>
      </div>

      <div className="mb-3 w-full rounded bg-white p-2 text-xs text-gray-600">
        <div className="font-semibold">Direction:</div>
        <div className="mt-1">
          {normalizedDirection === null
            ? "No direction data"
            : `${compassDirection} (${normalizedDirection} deg)`}
        </div>
      </div>

      <div className="w-full rounded bg-white p-2 text-xs text-gray-600">
        <div className="mb-1 font-semibold">Scale:</div>
        <div className="space-y-0.5">
          <div>Calm: &lt;5 km/h</div>
          <div>Light: 5-11 km/h</div>
          <div>Moderate: 11-19 km/h</div>
          <div>Fresh: 19-28 km/h</div>
          <div>Strong: 28+ km/h</div>
        </div>
      </div>
    </div>
  );
}