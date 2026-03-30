import { Navigate, Route, Routes } from "react-router-dom";
import { TopNav } from "../components/TopNav";
import { ArticlesPage } from "./ArticlesPage";
import { HomePage } from "./HomePage";
import { NewsDetailPage } from "./NewsDetailPage";
import { NewsPage } from "./NewsPage";
import { RawSensorDataPage } from "./RawSensorDataPage";

export default function App() {
  return (
    <div className="min-h-dvh">
      <TopNav />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:id" element={<NewsDetailPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/sensors" element={<RawSensorDataPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-600">
          This is a prototype UI. FWI calculation + CSV ingest will be implemented
          once transmitter CSV columns are finalized.
        </div>
      </footer>
    </div>
  );
}

