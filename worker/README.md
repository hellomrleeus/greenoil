# Green Oil 后端服务 (Cloudflare Workers)

本目录包含 Green Oil 专用工作台的 Cloudflare Worker 完整服务代码。

## 核心功能与架构升级

1. **后台每日定时抓取更新 (Daily Cron Trigger)**：
   - 触发频次：每天夜间（UTC 03:00 / 多伦多夜间），配置为 `0 3 * * *`；
   - 自动轮询大多伦多各区域关键词，批量调用 Google Maps Places API (New) 的 `places:searchText`；
   - 将最新数据与历史数据去重合并，写入 Cloudflare KV (`RESTAURANTS_KV`) 高速缓存中。
   - **效果**：业务员日常高频查询完全走缓存，**零实时地图 API 费用消耗**！

2. **服务端高性能分页与多条件检索**：
   - `GET /api/restaurants` 支持：
     - `page` (页码，默认 1)
     - `pageSize` (每页条数，10 / 20 / 50 / 100)
     - `region` (所属区域筛选)
     - `category` (油炸品类筛选)
     - `keyword` (模糊搜索餐馆名、地址、电话、关键词)
     - `sort` (评分、评价数、名称)
   - 返回标准分页响应结构 `{ success: true, page, pageSize, total, totalPages, lastUpdated, data: [...] }`。

3. **手动全量同步接口**：
   - `POST /api/sync`：支持管理员在工作台“设置与服务”页面一键手动触发全量后台更新。

4. **安全登录与 Cookie 认证**：
   - 账号密码通过 Cloudflare 环境变量/Secrets（`WORKER_USERNAME` / `WORKER_PASSWORD`）安全托管，不在源码和公开仓库中存储。
   - 下发 `greenoil_session` Cookie（支持 `SameSite=None; Secure; HttpOnly` 跨域与 GitHub Pages 配合）。

---

## 部署指引

### 1. 使用 Wrangler 命令行部署（推荐）

1. 进入 `worker` 目录：
   ```bash
   cd worker
   ```

2. 登录 Cloudflare（首次使用需执行）：
   ```bash
   npx wrangler login
   ```

3. 创建 KV 缓存命名空间（推荐开启以获得持久化缓存能力）：
   ```bash
   npx wrangler kv:namespace create RESTAURANTS_KV
   ```
   命令执行后会输出形如：
   ```toml
   [[kv_namespaces]]
   binding = "RESTAURANTS_KV"
   id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```
   将其配置在 `worker/wrangler.toml` 中。

4. 配置账号密码及 Google Maps API 密钥（保存在 Cloudflare Secrets，不提交到代码仓库）：
   ```bash
   npx wrangler secret put WORKER_USERNAME
   npx wrangler secret put WORKER_PASSWORD
   npx wrangler secret put GOOGLE_MAPS_API_KEY
   ```

5. 部署到 Cloudflare：
   ```bash
   npx wrangler deploy
   ```

部署成功后，终端将输出您的 Worker 访问地址（例如 `https://greenoil-api.<your-subdomain>.workers.dev`）。将此地址填入前端工作台“⚙️ 设置”中的 API 地址即可！

---

### 2. 通过 Cloudflare 网页后台部署

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 点击 **Workers & Pages** -> **Create application** -> **Create Worker**。
3. 命名为 `greenoil-api`，点击 **Deploy**。
4. 点击 **Edit code**，将 `worker/index.js` 和 `worker/seed.js` 上传/粘贴并部署。
5. 在 Worker 的 **Settings** -> **Variables and Secrets** 中添加 `GOOGLE_MAPS_API_KEY`。
6. 在 Worker 的 **Settings** -> **Triggers** 中添加 Cron Trigger：`0 3 * * *`。
