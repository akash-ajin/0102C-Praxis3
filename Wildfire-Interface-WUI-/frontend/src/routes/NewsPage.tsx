import { Link } from "react-router-dom";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { mockAlerts } from "../data/mockAlerts";

export function NewsPage() {
  return (
    <div className="grid gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-bold">Neighborhood Wildfire News</div>
          <div className="mt-1 text-sm text-slate-600">
            Color-coded alerts from the community transmitter network (prototype
            data for now).
          </div>
        </div>
        <button
          type="button"
          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-900/10 hover:bg-slate-50"
          onClick={() => {
            window.alert(
              "In the real system, this would open a report form to submit missing alerts."
            );
          }}
        >
          Don’t see an alert? Let us know
        </button>
      </div>

      <Card title="Alerts for your locations" subtitle="Most recent first.">
        <div className="grid gap-3">
          {mockAlerts.map((a) => (
            <Link
              key={a.id}
              to={`/news/${a.id}`}
              className="group flex items-center justify-between gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-900/5 transition hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="truncate text-base font-semibold">
                    {a.title}
                  </div>
                  <Badge
                    severity={a.severity}
                    rightSlot={
                      <span className="text-xs text-slate-500">
                        {a.issuedAt}
                      </span>
                    }
                  />
                </div>
                <div className="mt-1 truncate text-sm text-slate-600">
                  {a.region}
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold text-slate-500 group-hover:text-slate-700">
                View →
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

