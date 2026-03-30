# Wildfire Interface (WUI)

Community wildfire hub with:
- **Home**: shows current region **FWI score** (via backend API; currently mock).
- **Neighborhood Wildfire News**: color-coded alerts with details (region, description, map, safety instructions).
- **Articles**: mock community articles.

## Quick start

Install deps:

```bash
npm install
```

Run dev servers (frontend + backend):

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5174`

## Backend API (current)

- `GET /api/fwi/current` → returns a mock FWI score + rating (placeholder for CSV + Canadian FWI calculation).

