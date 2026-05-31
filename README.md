# 基础预测系统后端

这是一个基于作业说明实现的 Polymarket 风格预测/投注后端系统，支持用户充值、下注、结算、取消、幂等键防重复请求、追加式账本和后台对账。

## 技术栈

- Node.js
- TypeScript
- Next.js API Routes
- Prisma
- SQLite
- Vitest
- Zod

## 安装与运行

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

默认数据库配置：

```env
DATABASE_URL="file:./dev.db"
API_KEY="change-me"
```

## 数据模型

### User

- `id`: 用户 ID
- `username`: 用户名，唯一
- `balance`: 当前余额，使用整数金额单位
- `createdAt`: 创建时间

### Bet

- `id`: 投注 ID
- `userId`: 用户 ID
- `gameId`: 游戏/市场 ID
- `amount`: 投注金额
- `status`: `PLACED` / `SETTLED` / `CANCELLED`
- `result`: `WIN` / `LOSE` / `null`

### LedgerEntry

账本为追加式模型，业务代码不会修改或删除历史账本。

- `DEPOSIT`: 充值，正数
- `BET_DEBIT`: 下注扣款，负数
- `BET_CREDIT`: 赢得结算，正数
- `BET_REFUND`: 取消退款，正数

用户余额应等于该用户所有账本金额之和。

## 状态机

允许的状态变化：

- `PLACED -> SETTLED`
- `PLACED -> CANCELLED`

禁止：

- `SETTLED -> *`
- `CANCELLED -> *`

非法状态变化返回 `409 Conflict`。

## 幂等键

充值和下注接口必须携带：

```http
Idempotency-Key: unique-key
```

同一操作范围内重复使用相同幂等键会返回 `409 Conflict`，不会重复记账或重复扣款。

## API

所有 API 均需携带：

```http
X-API-Key: change-me
```

服务端对每个接口范围和客户端标识做轻量限流，超过限制返回 `429 Too Many Requests`。

### 创建用户（辅助接口）

```http
POST /api/users
Content-Type: application/json
X-API-Key: change-me

{
  "username": "alice"
}
```

### 充值

```http
POST /api/users/:id/deposit
Content-Type: application/json
X-API-Key: change-me
Idempotency-Key: deposit-1

{
  "amount": 1000
}
```

响应：

```json
{
  "userId": "...",
  "balance": 1000,
  "ledgerEntryId": "..."
}
```

### 下注

```http
POST /api/bets
Content-Type: application/json
X-API-Key: change-me
Idempotency-Key: bet-1

{
  "userId": "...",
  "gameId": "game-1",
  "amount": 300
}
```

### 结算投注

```http
POST /api/bets/:id/settle
Content-Type: application/json
X-API-Key: change-me

{
  "result": "WIN"
}
```

`WIN` 会按投注金额返还余额并追加 `BET_CREDIT`；`LOSE` 不返还余额。

### 取消投注

```http
POST /api/bets/:id/cancel
X-API-Key: change-me
```

仅 `PLACED` 状态可取消。取消后返还投注金额并追加 `BET_REFUND`。

### 后台对账

```http
GET /api/admin/reconcile?userId=...
X-API-Key: change-me
```

响应包含：

- `storedBalance`: 用户表余额
- `ledgerBalance`: 账本合计余额
- `balanceMatches`: 两者是否一致
- `isConsistent`: 余额和投注账本是否整体一致
- `issues`: 不一致问题列表
- `summary`: 账本分类汇总

## 测试与验证

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run verify
```

`npm run verify` 会依次执行类型检查、lint 和测试。
