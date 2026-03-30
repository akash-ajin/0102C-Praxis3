import { NavLink } from "react-router-dom";

function linkClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-xl px-3 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-white/15 text-white ring-1 ring-white/15"
      : "text-white/85 hover:bg-white/10 hover:text-white",
  ].join(" ");
}

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-sky-600 to-blue-700 shadow-soft">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-white">Wildfire Interface (WUI)</div>
          <div className="text-xs text-white/80">
            Community hub - wildfire readiness - local alerts
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink to="/" className={linkClass} end>
            Home
          </NavLink>
          <NavLink to="/news" className={linkClass}>
            Neighborhood Wildfire News
          </NavLink>
          <NavLink to="/articles" className={linkClass}>
            Articles
          </NavLink>
          <NavLink to="/sensors" className={linkClass}>
            Raw Sensor Data
          </NavLink>
        </nav>
      </div>
    </header>
  );
}