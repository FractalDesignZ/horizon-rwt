# Horizon RWT

Auditable wellbore topology and drilling-intelligence studio.

Starts **empty**. Import LAS, CSV, JSON, or `data[channel, channel, …]` files — one or many. The ingest wrapper splits mixed objects (several wells in one file, type well + laterals) and maps columns. An optional assistant call sees only headers and a few sample rows; full curves stay local.

No field book is shipped. Generate test wells is a dry-run only.

## What it is

- **Import** — multi-file / multi-object ingest, column mapper
- **Dashboard / Fence / Compare** — pad geometry, stratigraphic hang, pair transfer
- **Predict / Steer** — Gate 3 residual law, geodesic advisory
- **Quality / Gates / Transfer** — correlation quality, acceptance checks, neighbor send
- **Drilling** — WOB / RPM / TRQ / ROP regimes
- **Audit / History** — certificate ledger, saved runs

## Run

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run build
```

## Stack

React 19, TanStack Start, Vite, Tailwind v4, Zustand. Kernel in `src/lib/rwt/`.

## Provenance

Operationalizes [rogii-wellbore-topology](https://github.com/ZuluYokohama/rogii-wellbore-topology).
