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

## Deploy (Aliyun ACK)

The app is deployed on Aliyun Container Service for Kubernetes (ACK):

- Public URL: https://queue-poc-nan.on-running.cn

After a deployment succeeds, seed the demo store **once** by running the seed
command **inside the API (backend) container**:

```bash
npm run db:seed -w @queue/api
```

This runs `prisma migrate deploy` first (applies all migrations) and then seeds
the demo store, so it is safe to run on a fresh DB. The command prints the signed
scan URL and the admin URL for the demo store — open them against the public URL,
e.g.:

```
Scan URL:   https://queue-poc-nan.on-running.cn/s/<storeId>?sig=<signature>
Admin page: https://queue-poc-nan.on-running.cn/admin/<storeId>
```

> Note: the PoC uses SQLite on the container's local volume and an in-memory
> `EventBus`/`RateLimiter`, so it must run as a **single instance**. Re-running
> the seed is idempotent on migrations but inserts demo data again.

## Useful scripts
- `npm run dev:api` / `npm run dev:web` — run one side only
- `npm run db:seed -w @queue/api` — re-seed demo data (also applies migrations)
- `npm run build:shared` — build the shared types package
