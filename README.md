# Queue PoC — On Running virtual queue

Independent monorepo (NestJS API + React web), per [doc/design.md](doc/design.md).
No WeChat dependency, no member login, no phone number — anonymous cookie identity.

## Stack
- **apps/api** — NestJS + Prisma (SQLite), SSE, Ready Pool queue logic
- **apps/web** — React + Vite (user queue page + operations backend)
- **packages/shared** — types/contracts shared by both
- No Redis in the PoC: `EventBus` / `RateLimiter` have in-memory implementations
  behind interfaces, swappable for Redis in production.

## Prerequisites
- Node 20+ (developed on Node 26), npm 10+

## Setup & run

```bash
# 1. install all workspaces
npm install

# 2. create the SQLite DB, run migrations, and seed a demo store
npm run db:setup -w @queue/api

# 3. start API + web together (builds shared first)
npm run dev
```

- API: http://localhost:3000
- Web: http://localhost:5173

The seed step prints a **signed scan URL** and the **admin URL** for the demo store, e.g.:

```
Scan URL:  http://localhost:5173/s/<storeId>?sig=<signature>
Admin page: http://localhost:5173/admin/<storeId>
```

Open the scan URL on one or more browsers/devices to take tickets, and the admin
page to call/serve/complete tickets and watch the Ready Pool refill live.

## Useful scripts
- `npm run dev:api` / `npm run dev:web` — run one side only
- `npm run db:seed -w @queue/api` — re-seed demo data
- `npm run build:shared` — build the shared types package
