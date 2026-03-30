import { Card } from "../components/Card";

const articles = [
  {
    id: "a1",
    title: "How to build a 72-hour go-bag for wildfire season",
    date: "Mar 2026",
    excerpt:
      "A practical checklist for meds, documents, power, and food—plus what to keep in your car vs. at home."
  },
  {
    id: "a2",
    title: "Understanding FWI: what the number really means",
    date: "Mar 2026",
    excerpt:
      "FWI combines weather-driven fuel moisture and fire behavior potential. Learn how to interpret changes day-to-day."
  },
  {
    id: "a3",
    title: "Neighborhood readiness: a simple 30-minute plan",
    date: "Mar 2026",
    excerpt:
      "A lightweight way to coordinate meet-up points, check-ins for vulnerable neighbors, and communication during outages."
  }
];

export function ArticlesPage() {
  return (
    <div className="grid gap-5">
      <div>
        <div className="text-2xl font-bold">Articles</div>
        <div className="mt-1 text-sm text-slate-600">
          Mock content for a community hub (no backend needed yet).
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {articles.map((a) => (
          <Card
            key={a.id}
            title={a.title}
            subtitle={
              <span className="inline-flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {a.date}
                </span>
                <span className="text-slate-500">Community</span>
              </span>
            }
          >
            <div className="text-sm text-slate-700">{a.excerpt}</div>
            <button
              type="button"
              className="mt-3 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-900/10 hover:bg-slate-50"
              onClick={() => window.alert("Prototype: article detail page TBD.")}
            >
              Read more
            </button>
          </Card>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-900/5">
        Next step (later): add an <span className="font-semibold">Articles</span>{" "}
        backend with categories, search, and community submissions.
      </div>
    </div>
  );
}

