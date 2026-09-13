# Green Oil 员工个人工作台 (Green Oil Workbench)

支持 **PC 和手机移动端自适应** 的业务工作台应用。
- **前端部署**：GitHub Pages (`https://hellomrleeus.github.io/greenoil/`)
- **后端服务**：Cloudflare Workers (Google Maps API 代理 & 认证)
- **安全认证**：由 Cloudflare Worker 存储 Secrets 并进行鉴权验证

---

## 核心功能

### 1. 账号登录与 Cookie 守护
- 账号密码由 Cloudflare Worker 安全加密存储（环境变量 Secrets 托管，不在前端或公开仓库存储）。
- 登录后生成 `greenoil_session` Cookie 保存在浏览器中（有效期 7 天），同时同步本地 Session，确保在 PC 宽屏与手机触屏（如 iOS Safari）中均能顺畅使用。

### 2. 多伦多油炸餐饮商家查询系统
- **区域筛选**：支持万锦 (Markham)、士嘉堡 (Scarborough)、北约克 (North York)、列治文山 (Richmond Hill)、多伦多市中心 (Downtown Toronto)、密西沙加 (Mississauga)、旺市 (Vaughan) 及全部 GTA 区域选择。
- **实时 API 与云端 KV 缓存**：
  - 调用 Cloudflare Worker 代理 Google Maps Places API (New) 全面检索大多伦多油炸餐饮商家，云端 KV 持久化缓存并支持定时更新。
- **Excel 17 项全维度对齐**：
  - 餐馆名称 (Name)、所属区域 (Region)、油炸分类 (Categories)、评分 (Rating)、评价总数 (Reviews)、当前营业状态 (Status)、营业时间 (Opening Hours)、消费档次 (Price)、详细地址 (Address)、联系电话 (Phone)、官方网站 (Website)、Google 地图链接 (Maps URL)、主营类型 (Primary Type)、匹配关键词 (Keywords)、纬度 (Latitude)、经度 (Longitude)、Place ID。
- **多模式交互**：支持卡片视图、Excel 表格视图、电话直拨、地图导航、一键复制、一键导入用油计算器、以及导出为 CSV/Excel。

### 3. 纯前端商用用油计算器
- **动态炸锅配置**：
  - 默认 2 个炸锅，每个炸锅默认容量 20 升。
  - 支持自由“+ 添加炸锅”与“删除炸锅”，每个炸锅容量输入框严格限制为纯数字/小数输入。
- **炸油更换频率**：
  - 交互文案：“每 [ X ] 天换 [ Y ] 次，每次换 [ Z ] 个炸锅的油”。
  - 输入框严格限制为纯数字输入。
- **精准核算与 Green Oil 业务赋能**：
  - 预计餐馆每月消耗食用油总量（升）。
  - 折合标准商用油桶数（35 lb / 16L JIB 桶数）。
  - 预估可回收废食用油（UCO）回收量（基于行业标准 75% 废油率）。
  - 推荐 Green Oil 回收桶配置（55 加仑标准大桶配置及周期建议）。
  - 一键复制格式化核算单，方便现场通过微信/短信与商家沟通报价。

---

## 项目结构
```
greenoil/
├── index.html                   # 前端单页面应用主入口 (GitHub Pages)
├── assets/
│   ├── css/
│   │   └── app.css              # 现代科技环保绿主题样式，响应式 PC/移动端适配
│   └── js/
│       ├── app.js               # 应用主控制器与初始化
│       ├── auth.js              # 登录认证与 Cookie 管理
│       ├── api.js               # Cloudflare Worker API 客户端
│       ├── restaurants.js       # 餐馆查询、筛选、详情弹窗与 CSV 导出
│       └── calculator.js        # 纯前端用油与废油回收计算器
├── worker/                      # Cloudflare Worker 后端代码
│   ├── index.js                 # Worker 核心路由 (Login, Check, Google Maps API)
│   ├── wrangler.toml            # Wrangler 配置文件
│   ├── package.json             # Worker 依赖配置
│   └── README.md                # Worker 部署指引
├── scripts/
│   └── convert_xlsx.py          # Excel 转 JSON 工具脚本
├── fried_food_restaurants_markham_scarborough.xlsx # 原始数据表
└── README.md
```

---

## 快速启动与部署

### 1. 本地预览测试
```bash
# 在项目根目录下启动本地静态服务器
python3 -m http.server 8080
# 浏览器访问 http://localhost:8080
```

### 2. GitHub Pages 托管
本仓库直接托管在 GitHub Pages。打开仓库设置中 **Settings -> Pages**，将 Source 选为 `Deploy from a branch`，Branch 选为 `main` / `root` 即可。

### 3. Cloudflare Worker 部署
参见 [worker/README.md](worker/README.md)。执行 `npx wrangler deploy` 即可部署后端服务。

### 地图区划数据

- 城市边界：Statistics Canada 2021 Census subdivisions，经 Esri Canada 公共镜像读取；来源与版本保存在 `assets/data/official_municipalities.json`。运行 `python3 scripts/build_gta_municipalities.py` 可重建。
- 社区边界：City of Toronto Open Data 的 158 个官方社区，运行 `python3 scripts/build_gta_neighbourhoods.py` 可重建。
- 其他城市目前仅展示官方城市边界，不再使用手绘商圈代替行政区划。全部区域显示各城市真实边界。
