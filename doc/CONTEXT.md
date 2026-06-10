# 项目上下文交接 (CONTEXT) — queue_poc

> 用途：在**其他 AI 终端 / 新 session** 中作为参考文件，快速建立对本项目的完整上下文。
> 阅读顺序建议：本文件 → [requirement.txt](requirement.txt)（原始需求）→ [design.md](design.md)（完整设计）。
> 最后更新：2026-06-09

---

## 0. 一句话概述

为**昂跑（On Running China）线下门店**做的**扫码取号排队系统** PoC。核心诉求：体验**简单丝滑**、**不限微信**、**不要求注册会员**、**不要求手机号**、**独立可全球复用**。当前已完成需求分析、设计文档与可运行 PoC（NestJS + React monorepo），并通过端到端冒烟测试。

---

## 1. 项目背景

- 客户：昂跑（On Running），先 for China，但**要求未来可作为 global service 复用**。
- 现有系统（与本项目**解耦**，仅作背景）：
  1. 微信小程序会员系统（注册会员、购买、简单 CRM）。
  2. iOS POS 系统（店员提交订单、付款、收集 BI 数据）。
  3. 后端：阿里云 ACK + NodeJS/NestJS microservice（gateway / customer / product / order / promotion / common），**均为 China service**。
- 本排队系统刻意**不复用** China 侧的 gateway / common，原因见 §3。

---

## 2. 核心设计原则（决策的"宪法"）

1. **为"中间摇摆派"客户设计**，而非两端极端客户。任何一次"输入 / 授权 / 注册"动作都是漏斗流失点，取号主链路用户操作数趋近于零。
2. **不限定微信小程序**：任何 H5 浏览器（微信 / 支付宝 / WhatsApp / Chrome / Safari）皆可。
3. **不要求注册会员**：排队是低承诺即时服务，强制注册是劝退点（国际惯例）。
4. **不要求手机号**：手机号属个人信息，触发 PIPL/GDPR 合规义务；店内排队场景"离店远程提醒"需求几乎不存在，**一期直接砍掉手机号**。
5. **指纹（Fingerprint）不可作为身份主键**（重要正式条款）：UA+Canvas+屏幕参数在 iOS Safari/隐私模式下极不稳定，且采集指纹本身即采集个人信息（踩合规线）。仅可作**辅助风控（防刷号）**，身份识别一律用服务端签发的匿名 token。
6. **极简隐私说明**：一行字 +可展开，"我们仅用一个匿名标识为你保留排队号，不收集你的个人信息"。
7. **国际化预留**：多语言 / 多时区 / 可替换通知通道做成抽象层，但一期不实现多通道（避免过度设计）。

---

## 3. 已敲定的关键决策（含取舍理由）

| 主题 | 决策 | 理由 |
|---|---|---|
| 身份识别 | 服务端签发匿名 `clientId`（UUID）+ HttpOnly Cookie | 零用户输入；同设备重复扫码幂等返回原号；国际 virtual queue 主流做法 |
| 状态保持 | 状态在服务端，页面只是视图；落地页 URL 即回访短链 `/s/{storeId}?sig=` | 关闭页面不丢号；浏览器历史/收藏/重新扫码三路回访 |
| 实时推送 | SSE（Server-Sent Events） | 比 WebSocket 轻，契合单向进度通知；断线自动重连后凭 token 对账 |
| 门店码 | **静态二维码**（贴纸/立牌）+ `HMAC-SHA256(storeId, SECRET)` 长期签名 | 签名只防伪造 storeId；防刷靠取号接口的 token 幂等 + 内存限流；PoC 不做密钥轮换/有效期 |
| 叫号机制 | **Ready Pool 缓冲区模型**（非纯逐个、非大批量） | 门店是多店员并行服务；`capacity = staffCount + buffer`，逐个补位、批量在场 |
| 容量联动 | 自动：`capacity = staffCount + buffer`（PoC `buffer=1`）；`staffCount` 后台可手改 | 调小容量时不强制踢出已 READY 的号，仅暂停补位直到回落 |
| 门店/队列 | 门店独立编号；**不区分服务类型**，每门店单队列 | 简化模型，符合业务 |
| 运营后台 | 需要；**PoC 不鉴权**，鉴权留二期 | 实时看板/叫号/serve/done/过号召回/清场/改 staffCount |
| BI 数据 | 排队服务默认与会员系统**无数据联系**（trade-off 接受） | 仍产出匿名行为数据；预留 `memberId` 外键做二期自愿绑定 |
| 架构 | **独立 repo + monorepo 前后端一体 + NestJS（非 Python/Flask）** | 全球中立靠架构边界（不 import China 模块），换语言解决不了复用反增异构负债 |
| 基础设施 | **SQLite + 无 Redis**（PoC） | 零运维；EventBus/RateLimiter 封装成接口，生产换 Redis；ORM 抽象，生产换 PostgreSQL |

### 二期预留（仅留接口/数据结构，未实现）
- 匿名 `clientId` ↔ 会员 `memberId` **自愿绑定**（单向外键；诱饵：插队权益/等待积分/成交后售后延保），仅在高意愿节点抛出，绝不放取号入口。
- opt-in 远程提醒（PWA Web Push / 微信模板消息等**不落地个人信息**渠道）。
- 运营后台店员/店长鉴权。
- BI 数据统计页扩展。

---

## 4. 技术选型（用户已拍板）

- 前端：**React + Vite**
- 后端：**NestJS**
- ORM：**Prisma**（SQLite，生产换 PostgreSQL）
- Monorepo：**npm workspaces**
- 预置 **seed** 数据（1 门店 + 门店码 + 若干测试号）
- 运行：本地 npm 脚本（前后端各一条 dev）

---

## 5. 当前代码结构

```
queue_poc/
├── package.json              # npm workspaces 根 (apps/* + packages/*)
├── README.md                 # 运行说明
├── doc/
│   ├── requirement.txt       # 原始需求
│   ├── design.md             # 完整设计文档
│   └── CONTEXT.md            # 本文件
├── packages/shared/          # @queue/shared: 前后端共享类型/状态机/常量
│   └── src/index.ts          # TicketStatus 枚举、各 View 类型、READY_POOL_BUFFER
└── apps/
    ├── api/                  # @queue/api: NestJS + Prisma
    │   ├── prisma/
    │   │   ├── schema.prisma  # Store / Client / Ticket
    │   │   └── seed.ts        # 预置 demo 门店 + 打印签名扫码URL/后台URL
    │   └── src/
    │       ├── main.ts
    │       ├── app.module.ts
    │       ├── prisma/        # PrismaService
    │       ├── infra/         # EventBus / RateLimiter 接口 + 内存实现
    │       ├── common/        # QrSignatureService(HMAC) + 匿名 cookie 常量
    │       └── queue/         # 核心: queue.service / queue/admin/sse/store controller
    └── web/                   # @queue/web: React + Vite
        ├── vite.config.ts     # /api 代理到 3000；alias @queue/shared → src
        └── src/
            ├── main.tsx       # 路由: /s/:storeId(取号) /admin/:storeId(后台)
            ├── api.ts         # fetch 封装(credentials: include)
            ├── i18n.ts        # 极简中/英 i18n
            └── pages/         # QueuePage(用户) / AdminPage(运营后台)
```

### 排队状态机（design.md §3.4）
```
WAITING ──(进 Ready Pool)──► READY ──(店员确认)──► SERVING ──► DONE
   │                           │
   │                           └──(超时未响应)──► MISSED ──(店员召回)──► READY
   └──(用户放弃 / 闭店清队)──► CANCELLED
```

### 主要 API
- 用户侧：`POST /api/tickets`（取号，幂等）、`GET /api/tickets/me`、`GET /api/tickets/me/stream`（SSE）、`DELETE /api/tickets/me`、`GET /api/stores/:storeId`
- 运营侧（PoC 不鉴权）：`GET /api/admin/stores/:storeId/queue`、`POST .../call-next`、`POST .../reset`、`POST .../staff-count`、`POST /api/admin/tickets/:id/{serve,done,miss,recall}`

---

## 6. 如何运行

```bash
npm install
npm run db:setup -w @queue/api   # 建库 + 迁移 + seed（会打印扫码URL与后台URL）
npm run dev                      # 同时起 API(:3000) + Web(:5173)
```
- 单独跑：`npm run dev:api` / `npm run dev:web`
- 重新 seed：`npm run db:seed -w @queue/api`
- seed 会打印 demo 门店的**签名扫码 URL**（`http://localhost:5173/s/<storeId>?sig=<sig>`）和**后台 URL**（`/admin/<storeId>`），浏览器直接打开即可演示。
- **二维码图片**：在**运营后台页**点【Show store QR】即可看到由 `scanUrl` 渲染的静态二维码（`qrcode.react`），可【Print】打印张贴。二维码本身是 URL 文本编码成图，后端在 `GET /api/admin/stores/:storeId/queue` 的响应里下发 `scanUrl`（签名由持有 SECRET 的后端生成）。

---

## 7. 已验证（冒烟测试，2026-06-09）

- ✅ 匿名 token 取号 + **幂等**（重复取号返回原号）
- ✅ 坏签名门店码 → **403**
- ✅ **Ready Pool 自动补位**：staffCount=2 → capacity=3，#1/2/3 自动 READY
- ✅ serve→done → 自动补 #4 进 READY
- ✅ staffCount 2→3 → capacity=4，自动补 #5
- ✅ React 前端构建 + HTTP 200

---

## 8. 踩坑与注意事项（迁移/续作时务必注意）

- **不要在 main.ts 加 `ValidationPipe`**，除非装了 `class-validator`。当前 DTO 是纯 interface，无需校验；误加会导致 bootstrap 报错且不监听端口。
- **Vite 无法从 shared 的 CJS `dist` 解析 enum 命名导出**。解决：`vite.config.ts` 用 alias 把 `@queue/shared` 指向 `packages/shared/src/index.ts` 源码；后端（NestJS）仍消费 `dist`。
- web 代码中：**类型用 `import type`，值（如 `TicketStatus` 枚举）用普通 `import`**，否则 rollup 报 "not exported"。
- 环境：Node 20+（开发用 Node 26）、npm 10+。
- `.env`（apps/api）：`DATABASE_URL`、`STORE_QR_SECRET`、`PORT`、`WEB_ORIGIN`。

---

## 9. 可能的下一步（尚未做）

- 后台看板接 SSE（当前用 2s 轮询）。
- 自动过号超时（READY 超时自动 → MISSED）。
- 接口/单元测试。
- 二期预留项落地（会员自愿绑定、远程提醒、后台鉴权、BI 统计页）。
