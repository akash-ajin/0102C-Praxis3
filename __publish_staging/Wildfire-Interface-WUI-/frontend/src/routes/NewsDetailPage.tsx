import { Link, useParams } from "react-router-dom";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { MockRegionMap } from "../components/MockRegionMap";
import { mockAlerts } from "../data/mockAlerts";

export function NewsDetailPage() {
  const { id } = useParams();
  const alert = mockAlerts.find((a) => a.id === id);

  if (!alert) {
    return (
      <Card title="Alert not found" subtitle="That alert may have expired.">
        <div className="text-sm text-slate-600">
          Go back to the{" "}
          <Link to="/news" className="font-semibold text-sky-700">
            alert list
          </Link>
          .
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Card
          title={
            <div className="flex items-center gap-3">
              <Link
                to="/news"
                className="rounded-xl bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                ← Alerts
              </Link>
              <span className="truncate">{alert.title}</span>
            </div>
          }
          subtitle={
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{alert.region}</span>
              <span className="text-slate-400">·</span>
              <span>{alert.issuedAt}</span>
            </div>
          }
          right={<Badge severity={alert.severity} />}
        >
          <div className="grid gap-4">
            <div>
              <div className="text-sm font-semibold">Description</div>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                {alert.description}
              </p>
            </div>

            <div>
              <div className="text-sm font-semibold">Safety instructions</div>
              <ul className="mt-2 grid gap-2 text-sm text-slate-700">
                {alert.safetyInstructions.map((s, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-900/5"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <MockRegionMap label={alert.region} />

        <div className="mt-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-900/5">
          <div className="text-sm font-semibold">Share</div>
          <div className="mt-1 text-sm text-slate-600">
            In the full product, this will generate a shareable link/SMS and
            downloadable safety checklist.
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            onClick={() => {
              window.alert("Prototype: share action placeholder.");
            }}
          >
            Share this alert
          </button>
        </div>
      </div>
    </div>
  );
}

