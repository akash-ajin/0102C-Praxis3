export function MockRegionMap({ label }: { label: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between border-b border-slate-900/5 px-4 py-3">
        <div className="text-sm font-semibold text-slate-800">Region map</div>
        <div className="text-xs text-slate-600">{label}</div>
      </div>
      <div className="p-4">
        <svg
          viewBox="0 0 640 360"
          className="h-[220px] w-full"
          role="img"
          aria-label={`Map highlighting ${label}`}
        >
          <defs>
            <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#dbeafe" />
              <stop offset="1" stopColor="#bfdbfe" />
            </linearGradient>
            <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f8fafc" />
              <stop offset="1" stopColor="#eef2ff" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="640" height="360" fill="url(#land)" />

          <path
            d="M30 260 C 80 220, 110 240, 160 210 C 220 170, 260 180, 320 150 C 380 120, 430 140, 510 100 C 570 70, 600 80, 620 60 L 640 0 L 0 0 Z"
            fill="url(#water)"
            opacity="0.6"
          />

          <g opacity="0.25" stroke="#0f172a" strokeWidth="1">
            {Array.from({ length: 10 }).map((_, i) => (
              <path
                key={i}
                d={`M ${40 + i * 60} 20 L ${10 + i * 60} 340`}
                fill="none"
              />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <path
                key={i}
                d={`M 20  ${50 + i * 55} L 620 ${40 + i * 55}`}
                fill="none"
              />
            ))}
          </g>

          <path
            d="M355 95 L430 85 L500 120 L515 195 L470 250 L385 260 L330 210 L320 145 Z"
            fill="#ef4444"
            opacity="0.25"
            stroke="#dc2626"
            strokeWidth="4"
          />

          <circle cx="410" cy="175" r="6" fill="#dc2626" />
          <text
            x="424"
            y="179"
            fontSize="14"
            fill="#0f172a"
            opacity="0.7"
          >
            {label}
          </text>
        </svg>
      </div>
    </div>
  );
}

