# Powerlifting meet manager

Web app for running powerlifting competitions: competitions and lifters, groups, referee signaling, live display screens (scores, flight order, IPF plate loading), and Goodlift-style results.

## Stack

- **React 18** + **TypeScript**
- **Vite 7**
- **Tailwind CSS**
- **React Router** (hash-based routing for simple static hosting)
- **Firebase** (optional — realtime sync and persistence when configured)

## Prerequisites

- **Node.js** 20+ recommended  
- **npm** (ships with Node)

## Setup

```bash
npm install
```

### Environment variables (optional)

If the `VITE_FIREBASE_*` variables are **not** set, the app runs in **offline / localStorage-only** mode with no cloud database.

To enable Firebase, set the following in a `.env` file or as environment variables:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Dev server

```bash
npm run dev
```

Default dev URL: **http://localhost:5180** (override with `PORT=…`). The dev server listens on `0.0.0.0` so other devices on the LAN can open it (useful for referee tablets and projectors).

### Production build

```bash
npm run build
```

Output is written to `dist/`. Serve `dist/` as static files (any static host or `npm run serve` for a quick local preview).

### Other scripts

| Script        | Description                    |
|---------------|--------------------------------|
| `npm run serve`   | Preview production build (Vite preview) |
| `npm run typecheck` | TypeScript check only (`tsc --noEmit`) |

### Deploy base path

If the app is not served from the domain root, set:

```bash
BASE_PATH=/your-subpath/ npm run build
```

(`BASE_PATH` is read by `vite.config.ts`.)

## Routing

The app uses **hash routing** (e.g. `https://example.com/app/#/control`). Main areas:

| Hash route        | Purpose |
|-------------------|---------|
| `#/competitions`  | Competitions |
| `#/control`       | Meet control |
| `#/lifters`       | Lifters |
| `#/groups`        | Groups |
| `#/signals`       | Referee overview |
| `#/signals/:station` | Single referee station |
| `#/screen`        | Display screen launcher |
| `#/display/full`  | Live display (layout via query params) |
| `#/results`       | Admin results / GL points |
| `#/settings`      | Settings & backup |

## License

Private project unless noted otherwise by the repository owner.
