# Green Oil 后端服务 (Cloudflare Workers)

本目录包含 Green Oil 专用工作台的 Cloudflare Worker 完整代码。

## 功能特性
1. **固定凭据登录与 Cookie 认证**：
   - 默认账号：`greenoil`，默认密码：`greenoil2025`
   - 下发 `greenoil_session` Cookie（支持 `SameSite=None; Secure; HttpOnly` 跨域与 GitHub Pages 配合）
2. **Google Maps Places API (New) 代理**：
   - 接收区域、关键词，调用 Google Maps Places API (New) 的 `places:searchText`
   - 自动映射转换为与 Excel 文件完全一致的 17 个字段
3. **CORS 支持**：
   - 原生支持 GitHub Pages 域名与本地开发环境（携带凭据 `credentials: include`）

---

## 部署方式

### 方式 A：使用 Wrangler 命令行部署（推荐）

1. 进入 `worker` 目录：
   ```bash
   cd worker
   ```

2. 登录 Cloudflare（首次使用需执行）：
   ```bash
   npx wrangler login
   ```

3. （可选）配置 Google Maps API 密钥：
   ```bash
   npx wrangler secret put GOOGLE_MAPS_API_KEY
   # 提示时粘贴您的 Google Maps API Key
   ```

4. （可选）修改固定账号密码：
   在 `wrangler.toml` 中修改 `WORKER_USERNAME` 和 `WORKER_PASSWORD`，或使用 secret：
   ```bash
   npx wrangler secret put WORKER_USERNAME
   npx wrangler secret put WORKER_PASSWORD
   ```

5. 部署到 Cloudflare：
   ```bash
   npx wrangler deploy
   ```

部署成功后，终端将输出您的 Worker 访问地址（例如 `https://greenoil-api.<your-subdomain>.workers.dev`）。将此地址填入前端页面右上角“⚙️ 设置”中的 API 地址即可！

---

### 方式 B：通过 Cloudflare 网页后台直接部署

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 点击左侧 **Workers & Pages** -> **Create application** -> **Create Worker**。
3. 给 Worker 命名为 `greenoil-api`，点击 **Deploy**。
4. 点击 **Edit code**，将 `worker/index.js` 中的全部内容粘贴覆盖编辑器中的代码，点击 **Save and deploy**。
5. 在 Worker 的 **Settings** -> **Variables and Secrets** 中添加：
   - `GOOGLE_MAPS_API_KEY`（Secret）
   - `WORKER_USERNAME`（默认 `greenoil`）
   - `WORKER_PASSWORD`（默认 `greenoil2025`）
