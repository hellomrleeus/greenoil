# Green Oil 后端服务 (Cloudflare Workers)

本目录包含 Green Oil 专用工作台的 Cloudflare Worker 完整服务代码。

## 核心功能与架构升级

1. **外勤销售 (Field Sale) 业务支撑与 D1 持久化**：
   - `GET /api/sales`：获取团队全部拜访记录（D1 `sales` 表；无 D1 时回退到 KV 键 `field_sales_records`）。
   - `POST /api/sales`：创建销售拜访记录（支持记录拜访方式、精确到小时的时间、意向/签约/拒绝/已签其他结果、二级原因及竞品报价）。
   - `PUT /api/sales`：修改拜访记录。
   - `DELETE /api/sales?id=...`：删除拜访记录。

2. **餐馆现场修改与新增同步至 D1**：
   - `POST /api/restaurants/update`：现场修改餐馆电话、地址、负责人等，更新 Cloudflare D1，全局即时生效。
   - `POST /api/restaurants/add`：通过 Google Maps 检索或现场新增餐馆，自动格式化并收录至 D1；无 D1 时回退到 KV。

3. **Google Maps API 代理恢复**：
   - `GET /api/places/search?query=...`：代理 Google Maps Places API (New) Text Search，带大多伦多地域偏好，自动转换为标准 17 字段结构。
   - `POST /api/routes/plan`：代理 Google Routes API / 经纬度拓扑估算，生成预计里程、行车时间及官方 Google Maps App 导航直链。

4. **服务端高性能分页与多条件检索**：
   - `GET /api/restaurants`：D1 使用索引支持分页、区域、商圈、分类、关键词检索与多维度排序；地图请求额外支持 `bbox=west,south,east,north`，只返回当前视口范围的数据。
   - `GET /api/hubs`：大多伦多核心商圈与商业综合体聚合汇总。

5. **安全登录与 Cookie 认证**：
   - 账号密码通过 Cloudflare 环境变量/Secrets（`WORKER_USERNAME` / `WORKER_PASSWORD`）安全托管。
   - 下发 `greenoil_session` Cookie（支持 `SameSite=None; Secure; HttpOnly` 跨域与 GitHub Pages 配合）。

---

## 部署指引

### 1. 配置 Google Maps API 密钥（如需使用在线地图检索）
```bash
cd worker
npx wrangler secret put GOOGLE_MAPS_API_KEY
# 提示时粘贴您的 Google Maps API Key
```

餐馆数据已迁移到 D1 数据库 `greenoil-restaurants`。餐馆地图查询使用 `bbox=west,south,east,north` 经纬度条件，一次返回当前范围内的完整结果；D1 迁移完成后，餐馆数据相关 KV 键不再需要。商圈汇总和路线配置仍保存在 KV。

### 2. 部署到 Cloudflare
```bash
npx wrangler deploy
```
