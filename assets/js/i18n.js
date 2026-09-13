/**
 * Green Oil Workbench Internationalization (i18n) Module
 * Supports: Chinese (zh), English (en), Korean (ko)
 */

export const TRANSLATIONS = {
  zh: {
    // Topbar & Global
    app_title: "Green Oil 工作台",
    page_title_restaurants: "餐馆查询",
    page_title_calculator: "用油计算器",
    page_title_greasetrap: "Grease Trap",
    nav_restaurants: "餐馆查询",
    nav_calculator: "用油计算器",
    nav_greasetrap: "Grease Trap",
    btn_logout: "退出登录",
    status_connecting: "连接中",
    status_online: "正常",
    status_offline: "离线",
    status_connected: "已连接",
    status_disconnected: "未连接",
    confirm_logout: "确定退出登录？",

    // Tab 1: Restaurant Search & Filters
    search_label: "搜索",
    search_placeholder: "搜索餐馆名、地址或关键词...",
    region_label: "选择区域",
    region_all: "全部区域 (All GTA)",
    region_markham: "万锦 (Markham)",
    region_scarborough: "士嘉堡 (Scarborough)",
    region_north_york: "北约克 (North York)",
    region_richmond_hill: "列治文山 (Richmond Hill)",
    region_downtown: "多伦多市中心 (Downtown Toronto)",
    region_mississauga: "密西沙加 (Mississauga)",
    region_vaughan: "旺市 (Vaughan)",
    sort_label: "排序",
    sort_rating: "评分由高到低",
    sort_reviews: "评价数量由多到少",
    sort_name: "餐馆名称 A-Z",
    btn_select_page: "全选本页",
    btn_export_csv: "导出所选",
    cat_label: "品类筛选：",
    cat_all: "全部",
    cat_chinese: "中式/台式炸物",
    cat_western: "西式炸鸡快餐",
    cat_korean: "韩式炸鸡",
    cat_fish_chips: "炸鱼薯条",
    cat_japanese: "日式炸物",
    cat_sweets: "热狗/甜甜圈",
    hub_label: "商圈 / 商场",
    hub_all: "全部商圈与商场",
    view_card: "卡片视图",
    view_table: "表格视图",
    view_hubs: "商圈聚合",
    view_list: "列表视图",
    view_calendar: "日历视图",
    btn_plan_route: "规划路线",
    btn_add_to_route: "+ 加入路线",
    btn_add_waypoint: "+ 途径站点",
    cal_prev_month: "上月",
    cal_next_month: "下月",
    cal_today: "今天",
    cal_visits_count: "{count} 次拜访",
    cal_no_visits: "该日期暂无拜访记录",
    cal_btn_add_visit: "+ 录入此日拜访",
    fs_route_saved_success: "路线站点已同步至云端",
    results_count: "共 {total} 家餐馆",
    no_matching_restaurants: "无匹配餐馆",
    hub_card_count: "{count} 家餐馆",
    hub_card_oil: "月预估废油 ~{liters}L ({drums} 桶)",
    hub_card_avg_rating: "平均评分",
    hub_card_btn: "查看此商圈餐馆",

    // Table Headers
    th_name: "餐馆名称",
    th_region: "区域",
    th_hub: "商圈/商场",
    th_category: "分类",
    th_rating: "评分与评价",
    th_status: "状态",
    th_price: "消费档次",
    th_address: "地址",
    th_phone: "电话",
    th_actions: "操作",

    // Status Values
    status_open: "营业中",
    status_closed: "已打烊",
    status_unknown: "未知",

    // Card Action Buttons
    btn_calc_oil: "计算用油",
    btn_calc_trap: "隔油池",
    btn_details: "详情",

    // Pagination
    page_info: "第 {page} / {totalPages} 页",
    pagination_range: "第 {start}-{end} 条，共 {total} 家",
    page_size_label: "每页：",
    page_unit: "条",
    page_first: "第一页",
    page_prev: "上一页",
    page_next: "下一页",
    page_last: "最后一页",

    // Selection Bar
    sel_selected: "已选",
    sel_count: "{count} 家餐馆",
    btn_clear: "清空选择",
    btn_clear_selection: "清空选择",
    btn_export_selection: "导出所选 ({count} 家)",

    // Detail Modal
    modal_title: "餐馆详情",
    modal_cat: "分类",
    modal_hub: "所属商圈/商场",
    modal_rating: "评分与评价",
    modal_address: "地址",
    modal_phone: "电话",
    modal_hours: "营业时间",
    modal_keywords: "关键词与类型",
    modal_place_id: "Place ID 与坐标",
    btn_modal_call: "拨打电话",
    btn_modal_website: "官网",
    btn_modal_maps: "Google 地图",
    btn_modal_import_oil: "导入用油计算",
    btn_modal_import_trap: "隔油池测算",
    hours_not_provided: "未提供",

    // Tab 2: Oil Calculator
    calc_fryer_params: "炸锅参数",
    calc_linked_rest: "关联餐馆",
    calc_fryer_list: "炸锅列表",
    calc_fryer_count_unit: "{count} 个",
    btn_add_fryer: "添加炸锅",
    calc_fryer_badge: "炸锅 #{index}",
    calc_capacity_placeholder: "容量",
    calc_unit_liter: "升",
    calc_unit_drum: "桶",
    calc_freq_title: "更换频率",
    calc_freq_prefix: "每",
    calc_freq_days_suffix: "天换",
    calc_freq_times_suffix: "次，每次换",
    calc_freq_fryers_suffix: "个炸锅的油",
    btn_calc_oil_submit: "计算月用油量",
    btn_calc_reset: "重置",
    calc_res_title: "用油与废油测算",
    calc_res_monthly_label: "预计月用油总量",
    calc_res_monthly_unit: "升 / 月",
    calc_res_std_drums: "折合商用标准桶 (16L)",
    calc_res_uco: "预计废油回收量 (75%)",
    calc_res_200l_drums: "推荐回收设备 (Drum / Bin)",
    calc_res_baseline: "计算基准",
    calc_res_30days: "30 天 / 月",
    calc_res_advice_title: "回收方案：",
    btn_copy_oil_quote: "复制测算结果",
    advice_drum_200: "配置 1 个 200L Drum 标准圆桶，按月或按需回收",
    advice_bin_400: "配置 1 个 400L 大型储油箱 (Bin)，每 3-4 周回收 1 次",
    advice_bin_600: "配置 1 个 600L 大型储油箱 (Bin)，每 2-3 周回收 1 次",
    advice_bin_800: "配置 1 个 800L 大型储油箱 (Bin)，每 1-2 周回收 1 次",
    advice_bin_1000: "配置 1 个 1000L 特大型储油箱 (Bin)，每周高频定时回收",
    advice_bin_multi: "配置 {count} 个 1000L 大型储油箱 (Bin)，每周高频定时回收",
    alert_at_least_one_fryer: "至少保留 1 个炸锅",
    alert_invalid_input: "请输入有效的周期与数值",
    alert_calc_first: "请先计算",
    toast_copied_oil_quote: "已复制用油测算结果",

    // Tab 3: Grease Trap Workbench
    trap_title: "隔油池清洁配置 (Grease Trap)",
    trap_count_label: "隔油池数量",
    trap_count_n: "{n} 个",
    trap_size_label: "单个隔油池容量规格 (主单位: 公制升数 / 括号: 加仑)",
    trap_freq_label: "建议清洗频率",
    trap_freq_1: "每月清洗 1 次 (高客流餐饮推荐)",
    trap_freq_2: "每 2 个月清洗 1 次 (标准中大型餐馆)",
    trap_freq_3: "每季度清洗 1 次 (3个月 / 市政法定最低维保线)",
    trap_compliance_title: "市政环保排污合规说明",
    trap_compliance_body: "安省大多伦多各市镇（如多伦多 Bylaw 560、万锦与约克区 Sewer Use Bylaw）严格要求餐饮商户必须安装隔油池并定期由合规持牌服务商抽吸清洗。违规排废或油垢溢出将面临市政重罚及停业整顿。",
    btn_calc_trap_submit: "计算清洁费用",
    btn_reset_trap: "重置",
    trap_res_title: "隔油池清洁收费方案 (Ontario HST 13%)",
    trap_res_total_label: "单次清洁税后合计 (CAD)",
    trap_res_tax_badge: "含 13% HST",
    trap_res_price_label: "税前服务费",
    trap_res_tax_label: "安省税金 (13% HST)",
    trap_res_spec_label: "当前选定规格",
    trap_res_annual_label: "预计年度维保支出",
    trap_per_year: "/ 年",
    trap_process_title: "Green Oil 标准清洗工艺流程：",
    trap_process_body: "1. 彻底抽吸截留浮油、悬浮物与底部沉淀油泥<br>2. 高压冲洗四壁并刮擦油脂硬垢<br>3. 进出水隔板与过滤网疏通检查与密封还原",
    btn_copy_trap_quote: "复制隔油池清洁报价单",
    toast_copied_trap_quote: "已复制隔油池清洁报价单",


    // Login Modal
    login_title: "Green Oil 工作台",
    login_username_label: "账号",
    login_password_label: "密码",
    login_submit: "登录",
    login_error: "账号或密码错误",

    // Toast
    toast_export_excel: "已导出 Excel",
    toast_export_csv: "已导出 CSV",
    // Field Sale Workbench
    page_title_fieldsale: "外勤销售",
    nav_fieldsale: "外勤销售",
    fs_tab_route: "路线规划",
    fs_tab_records: "拜访记录",
    fs_tab_analytics: "统计报告",

    // Route Planning
    fs_route_title: "外勤拜访路线规划",
    fs_route_origin: "起点地址 (Green Oil Inc)",
    fs_route_origin_placeholder: "Green Oil Inc, Toronto, ON",
    fs_route_use_gps: "使用当前GPS位置为起点",
    fs_route_add_restaurant: "添加餐馆到路线",
    fs_route_search_placeholder: "搜索餐馆名称或地址加入路线...",
    fs_route_stops: "途经站点 ({count} 家餐馆)",
    fs_route_empty: "暂未添加途经餐馆。您可以从餐馆查询列表勾选后一键导入，或在上方搜索添加。",
    fs_route_btn_go_query: "从餐馆查询批量选择导入 →",
    fs_route_btn_optimize: "智能最短路径排序",
    fs_route_btn_clear: "清空路线",
    fs_route_btn_calc: "生成路线规划",
    fs_route_btn_navigate: "在 Google 地图开启导航",
    fs_route_dist_label: "预计总里程",
    fs_route_dur_label: "预计行车时间",
    fs_route_stops_label: "途经餐馆数",
    btn_plan_route: "规划路线",
    btn_add_to_route: "加入路线",

    // Sales Records
    btn_log_visit: "记录拜访",
    fs_record_btn_new: "+ 新建拜访记录",
    fs_record_title_new: "新建外勤拜访记录",
    fs_record_title_edit: "编辑拜访记录",
    fs_record_select_rest: "关联餐馆",
    fs_record_gps_prompt: "🗺️ 优先推荐当前路线规划中的途经站点",
    fs_record_route_prompt: "🗺️ 优先推荐当前路线规划中的途经站点",
    fs_record_rest_not_found: "列表中未收录？",
    fs_record_btn_search_gmap: "通过 Google 地图添加",
    fs_record_method: "销售方式",
    fs_record_method_onsite: "现场拜访 (Onsite)",
    fs_record_method_phone: "电话沟通 (Phone)",
    fs_record_time: "拜访时间 (精确到小时)",
    fs_record_outcome: "销售结果",
    fs_record_outcome_signed: "签订合同",
    fs_record_outcome_interested: "有意向",
    fs_record_outcome_rejected: "拒绝",
    fs_record_outcome_signed_others: "已签其他",
    fs_reject_reason: "拒绝原因",
    fs_reject_price: "价格无优势",
    fs_reject_hassle: "觉得换油/换服务商麻烦",
    fs_reject_decision_maker: "店主不在/无法决策",
    fs_reject_low_volume: "用油量极少无回收价值",
    fs_reject_satisfied: "对目前服务商满意",
    fs_reject_other: "其他原因",
    fs_reject_detail_placeholder: "补充详细拒绝说明...",
    fs_others_reason: "签其他原因",
    fs_others_locked: "已有长期排他合同未到期",
    fs_others_equipment: "现任供应商提供特殊设备/高额补贴",
    fs_others_bundle: "现任供应商提供原料捆绑供货",
    fs_others_other: "其他原因",
    fs_competitor_quote_title: "竞品供应商报价与情报",
    fs_competitor_name: "其他供应商名称",
    fs_competitor_name_placeholder: "例如 Darling, Rothsay, 自营等",
    fs_competitor_quote: "竞品报价 / 补贴标准",
    fs_competitor_quote_placeholder: "例如 $0.25/L 或 $45/桶 或 赠送隔油池清洗",
    fs_contract_expiry: "竞品合同预计到期时间",
    fs_notes: "沟通纪要 / 下次拜访建议",
    fs_notes_placeholder: "记录关键沟通细节、用油规模、老板微信等...",
    fs_edit_rest_section: "现场核对/修改餐馆信息 (自动同步至 KV)",
    fs_rest_phone: "联系电话",
    fs_rest_address: "详细地址",
    fs_rest_contact: "联系人/老板",
    fs_rest_sync_tip: "保存记录时将同步更新餐馆数据库",
    fs_btn_save: "保存拜访记录",
    fs_record_saved_toast: "拜访记录已成功保存",
    fs_filter_all: "全部",
    fs_records_count: "共 {count} 条拜访记录",
    fs_no_records: "暂无拜访记录，点击上方按钮新增",

    // Google Maps Search Modal
    fs_gmap_modal_title: "通过 Google 地图搜索并添加新餐馆",
    fs_gmap_input_placeholder: "输入餐馆名称或地址 (例如 Popeyes Markham)...",
    fs_gmap_btn_search: "搜索 Google Maps",
    fs_gmap_search_hint: "将在大多伦多地区通过 Google Places 检索并自动解析",
    fs_gmap_searching: "正在检索 Google Maps...",
    fs_gmap_no_results: "未在 Google Maps 找到匹配结果，您可以手动录入餐馆",
    fs_gmap_btn_add: "添加并关联",

    // Analytics & Reports
    fs_analytics_title: "外勤销售统计报告与成单看板",
    fs_kpi_total_visits: "总拜访次数",
    fs_kpi_signed_count: "成功签约",
    fs_kpi_interested_count: "有意向",
    fs_kpi_conversion_rate: "签约转化率",
    fs_kpi_onsite_ratio: "现场拜访占比",
    fs_chart_outcomes_title: "销售结果分布",
    fs_chart_reasons_title: "拒绝与竞品流失原因分布",
    fs_chart_trend_title: "近期拜访活动趋势",
    fs_chart_methods_title: "销售方式成效对比",
    fs_chart_regions_title: "各区域拜访分布",
    fs_competitor_table_title: "现场竞品报价与情报汇总",
    fs_btn_export_sales: "导出销售报告 (Excel/CSV)",

    // Map Explorer
    page_title_mapexplorer: "地图找店",
    nav_mapexplorer: "地图找店",
    map_filter_city: "大区 / 城市",
    map_filter_neighborhood: "细分社区 / 商圈",
    map_filter_street: "主要商业走廊 / 街道",
    map_filter_kv: "KV 入库状态",
    map_follow_bounds: "跟随地图视野实时筛选",
    map_reset_view: "重置视角",
    map_select_area: "全选当前筛选",
    th_kv_status: "KV状态",
    filter_visited: "是否拜访",
    filter_outcome: "拜访结果",
    visited_all: "全部 (拜访状态)",
    visited_yes: "已拜访",
    visited_no: "未拜访",
    outcome_all: "全部结果",
    outcome_contract: "签订合同",
    outcome_interested: "有意向",
    outcome_considering: "考虑中",
    outcome_not_interested: "暂无意向",
    outcome_rejected: "拒绝合作",
    outcome_closed: "已打烊/关店"
  },

  en: {
    // Topbar & Global
    app_title: "Green Oil Workbench",
    page_title_restaurants: "Restaurant Search",
    page_title_calculator: "Oil Calculator",
    page_title_greasetrap: "Grease Trap",
    nav_restaurants: "Restaurants",
    nav_calculator: "Oil Calculator",
    nav_greasetrap: "Grease Trap",
    btn_logout: "Sign Out",
    status_connecting: "Connecting",
    status_online: "Online",
    status_offline: "Offline",
    status_connected: "Connected",
    status_disconnected: "Disconnected",
    confirm_logout: "Are you sure you want to sign out?",

    // Tab 1: Restaurant Search & Filters
    search_label: "Search",
    search_placeholder: "Search name, address or keyword...",
    region_label: "Select Region",
    region_all: "All Regions (All GTA)",
    region_markham: "Markham",
    region_scarborough: "Scarborough",
    region_north_york: "North York",
    region_richmond_hill: "Richmond Hill",
    region_downtown: "Downtown Toronto",
    region_mississauga: "Mississauga",
    region_vaughan: "Vaughan",
    sort_label: "Sort",
    sort_rating: "Rating: High to Low",
    sort_reviews: "Reviews: Most to Least",
    sort_name: "Name: A to Z",
    btn_select_page: "Select Page",
    btn_export_csv: "Export Selected",
    cat_label: "Categories:",
    cat_all: "All",
    cat_chinese: "Chinese/Taiwanese Fried",
    cat_western: "Western Fast Food/Wings",
    cat_korean: "Korean Fried Chicken",
    cat_fish_chips: "Fish & Chips",
    cat_japanese: "Japanese Katsu/Tempura",
    cat_sweets: "Corn Dogs/Donuts",
    hub_label: "Mall / Plaza",
    hub_all: "All Malls & Plazas",
    view_card: "Cards",
    view_table: "Table",
    view_hubs: "Hubs View",
    view_list: "List View",
    view_calendar: "Calendar View",
    btn_plan_route: "Plan Route",
    btn_add_to_route: "+ Add to Route",
    btn_add_waypoint: "+ Waypoint",
    cal_prev_month: "Prev",
    cal_next_month: "Next",
    cal_today: "Today",
    cal_visits_count: "{count} visits",
    cal_no_visits: "No visit records on this date",
    cal_btn_add_visit: "+ Log Visit for Date",
    fs_route_saved_success: "Route waypoints synced to cloud",
    results_count: "Total {total} restaurants",
    no_matching_restaurants: "No matching restaurants found",
    hub_card_count: "{count} restaurants",
    hub_card_oil: "Est. Monthly UCO ~{liters}L ({drums} drums)",
    hub_card_avg_rating: "Avg Rating",
    hub_card_btn: "View Restaurants in Hub",

    // Table Headers
    th_name: "Name",
    th_region: "Region",
    th_hub: "Mall / Plaza",
    th_category: "Category",
    th_rating: "Rating & Reviews",
    th_status: "Status",
    th_price: "Price",
    th_address: "Address",
    th_phone: "Phone",
    th_actions: "Actions",

    // Status Values
    status_open: "Open",
    status_closed: "Closed",
    status_unknown: "Unknown",

    // Card Action Buttons
    btn_calc_oil: "Calculate Oil",
    btn_calc_trap: "Grease Trap",
    btn_details: "Details",

    // Pagination
    page_info: "Page {page} of {totalPages}",
    pagination_range: "Showing {start}-{end} of {total}",
    page_size_label: "Per page:",
    page_unit: "items",
    page_first: "First",
    page_prev: "Prev",
    page_next: "Next",
    page_last: "Last",

    // Selection Bar
    sel_selected: "Selected",
    sel_count: "{count} restaurants",
    btn_clear: "Clear Selection",
    btn_clear_selection: "Clear Selection",
    btn_export_selection: "Export Selected ({count})",

    // Detail Modal
    modal_title: "Restaurant Details",
    modal_cat: "Category",
    modal_hub: "Mall / Plaza",
    modal_rating: "Rating & Reviews",
    modal_address: "Address",
    modal_phone: "Phone",
    modal_hours: "Business Hours",
    modal_keywords: "Keywords & Type",
    modal_place_id: "Place ID & Coordinates",
    btn_modal_call: "Call Phone",
    btn_modal_website: "Website",
    btn_modal_maps: "Google Maps",
    btn_modal_import_oil: "Import to Oil Calc",
    btn_modal_import_trap: "Grease Trap Quote",
    hours_not_provided: "Not provided",

    // Tab 2: Oil Calculator
    calc_fryer_params: "Deep Fryer Parameters",
    calc_linked_rest: "Linked Restaurant",
    calc_fryer_list: "Fryers List",
    calc_fryer_count_unit: "{count} units",
    btn_add_fryer: "Add Fryer",
    calc_fryer_badge: "Fryer #{index}",
    calc_capacity_placeholder: "Capacity",
    calc_unit_liter: "L",
    calc_unit_drum: "drums",
    calc_freq_title: "Replacement Frequency",
    calc_freq_prefix: "Every",
    calc_freq_days_suffix: "days,",
    calc_freq_times_suffix: "times, replace",
    calc_freq_fryers_suffix: "fryer(s) oil",
    btn_calc_oil_submit: "Calculate Monthly Usage",
    btn_calc_reset: "Reset",
    calc_res_title: "Oil Consumption & UCO Estimate",
    calc_res_monthly_label: "Est. Total Monthly Cooking Oil",
    calc_res_monthly_unit: "Liters / Mo",
    calc_res_std_drums: "Equivalent Standard Jugs (16L)",
    calc_res_uco: "Est. Used Cooking Oil (75%)",
    calc_res_200l_drums: "Recommended Container (Drum / Bin)",
    calc_res_baseline: "Calculation Baseline",
    calc_res_30days: "30 Days / Mo",
    calc_res_advice_title: "Pickup Recommendation:",
    btn_copy_oil_quote: "Copy Estimate Results",
    advice_drum_200: "Setup 1x 200L Drum, monthly or on-demand pickup",
    advice_bin_400: "Setup 1x 400L Storage Bin, pickup every 3-4 weeks",
    advice_bin_600: "Setup 1x 600L Storage Bin, pickup every 2-3 weeks",
    advice_bin_800: "Setup 1x 800L Storage Bin, pickup every 1-2 weeks",
    advice_bin_1000: "Setup 1x 1000L Max Bin, weekly scheduled pickup",
    advice_bin_multi: "Setup {count}x 1000L Bins, high-frequency weekly pickup",
    alert_at_least_one_fryer: "Must keep at least 1 fryer",
    alert_invalid_input: "Please enter valid frequency and parameters",
    alert_calc_first: "Please calculate first",
    toast_copied_oil_quote: "Oil estimate copied to clipboard",

    // Tab 3: Grease Trap Workbench
    trap_title: "Grease Trap Cleaning Configuration",
    trap_count_label: "Grease Trap Count",
    trap_count_n: "{n} unit(s)",
    trap_size_label: "Trap Capacity (Metric: Liters / Gallons in parenthesis)",
    trap_freq_label: "Recommended Cleaning Frequency",
    trap_freq_1: "Once a month (Recommended for high volume)",
    trap_freq_2: "Every 2 months (Standard medium/large restaurants)",
    trap_freq_3: "Every quarter (3 months / Municipal legal minimum)",
    trap_compliance_title: "Municipal Bylaw Compliance Notice",
    trap_compliance_body: "GTA Municipalities (e.g. Toronto Bylaw 560, York Region Sewer Use Bylaw) mandate all food establishments maintain grease interceptors and pump them regularly via licensed contractors. Non-compliance results in heavy fines and suspension.",
    btn_calc_trap_submit: "Calculate Cleaning Cost",
    btn_reset_trap: "Reset",
    trap_res_title: "Grease Trap Pricing Plan (Ontario HST 13%)",
    trap_res_total_label: "Per Clean Total with Tax (CAD)",
    trap_res_tax_badge: "incl. 13% HST",
    trap_res_price_label: "Pre-Tax Service Fee",
    trap_res_tax_label: "Ontario Tax (13% HST)",
    trap_res_spec_label: "Selected Specifications",
    trap_res_annual_label: "Est. Annual Maintenance Cost",
    trap_per_year: "/ yr",
    trap_process_title: "Green Oil Standard Cleaning Protocol:",
    trap_process_body: "1. Complete pump-out of grease cap, suspended solids, and bottom sludge<br>2. High-pressure wall jetting and scraping<br>3. Baffle plate and filter screen clearance and seal restoration",
    btn_copy_trap_quote: "Copy Grease Trap Quote",
    toast_copied_trap_quote: "Grease trap quote copied to clipboard",


    // Login Modal
    login_title: "Green Oil Workbench",
    login_username_label: "Username",
    login_password_label: "Password",
    login_submit: "Sign In",
    login_error: "Invalid username or password",

    // Toast
    toast_export_excel: "Excel Exported",
    toast_export_csv: "CSV Exported",
    // Field Sale Workbench
    page_title_fieldsale: "Field Sale",
    nav_fieldsale: "Field Sale",
    fs_tab_route: "Route Planning",
    fs_tab_records: "Sales Records",
    fs_tab_analytics: "Analytics & Reports",

    // Route Planning
    fs_route_title: "Field Visit Route Planning",
    fs_route_origin: "Origin Address (Green Oil Inc)",
    fs_route_origin_placeholder: "Green Oil Inc, Toronto, ON",
    fs_route_use_gps: "Use My Current GPS Location",
    fs_route_add_restaurant: "Add Restaurant to Route",
    fs_route_search_placeholder: "Search restaurant name or address...",
    fs_route_stops: "Waypoints ({count} restaurants)",
    fs_route_empty: "No waypoints added yet. Select restaurants from search list or search above to add.",
    fs_route_btn_go_query: "Select & Import from Restaurant Search →",
    fs_route_btn_optimize: "Optimize Route (Shortest Path)",
    fs_route_btn_clear: "Clear Route",
    fs_route_btn_calc: "Generate Route",
    fs_route_btn_navigate: "Open Navigation in Google Maps",
    fs_route_dist_label: "Est. Total Distance",
    fs_route_dur_label: "Est. Drive Time",
    fs_route_stops_label: "Total Stops",
    btn_plan_route: "Plan Route",
    btn_add_to_route: "Add to Route",

    // Sales Records
    btn_log_visit: "Log Visit",
    fs_record_btn_new: "+ New Sales Record",
    fs_record_title_new: "New Field Sales Record",
    fs_record_title_edit: "Edit Sales Record",
    fs_record_select_rest: "Linked Restaurant",
    fs_record_gps_prompt: "Recommended stops from route plan",
    fs_record_route_prompt: "🗺️ Prioritizing stops from current route planning list",
    fs_record_rest_not_found: "Not in database?",
    fs_record_btn_search_gmap: "Add via Google Maps",
    fs_record_method: "Sales Method",
    fs_record_method_onsite: "In-Person Visit (Onsite)",
    fs_record_method_phone: "Phone Call (Remote)",
    fs_record_time: "Visit Time (Hourly)",
    fs_record_outcome: "Sales Outcome",
    fs_record_outcome_signed: "Contract Signed",
    fs_record_outcome_interested: "Interested",
    fs_record_outcome_rejected: "Rejected",
    fs_record_outcome_signed_others: "Signed with Others",
    fs_reject_reason: "Rejection Reason",
    fs_reject_price: "Price not competitive",
    fs_reject_hassle: "Hassle to switch providers",
    fs_reject_decision_maker: "Decision maker not present",
    fs_reject_low_volume: "Oil volume too small",
    fs_reject_satisfied: "Satisfied with current provider",
    fs_reject_other: "Other reason",
    fs_reject_detail_placeholder: "Additional details regarding rejection...",
    fs_others_reason: "Reason for Choosing Others",
    fs_others_locked: "Existing long-term exclusive contract",
    fs_others_equipment: "Competitor provided tank/high subsidy",
    fs_others_bundle: "Competitor bundled with food supplies",
    fs_others_other: "Other reason",
    fs_competitor_quote_title: "Competitor Quote & Intelligence",
    fs_competitor_name: "Competitor / Supplier Name",
    fs_competitor_name_placeholder: "e.g. Darling, Rothsay, etc.",
    fs_competitor_quote: "Competitor Quote / Rebate Rate",
    fs_competitor_quote_placeholder: "e.g. $0.25/L or $45/drum or free grease trap cleaning",
    fs_contract_expiry: "Competitor Contract Expiry",
    fs_notes: "Meeting Notes & Next Steps",
    fs_notes_placeholder: "Key details, oil volume, manager contact/wechat...",
    fs_edit_rest_section: "Review/Edit Restaurant Info (Syncs to KV)",
    fs_rest_phone: "Phone",
    fs_rest_address: "Address",
    fs_rest_contact: "Contact Person / Owner",
    fs_rest_sync_tip: "Changes will sync to Cloudflare KV restaurant database",
    fs_btn_save: "Save Sales Record",
    fs_record_saved_toast: "Sales record saved successfully",
    fs_filter_all: "All",
    fs_records_count: "Total {count} sales records",
    fs_no_records: "No sales records found. Click above to add.",

    // Google Maps Search Modal
    fs_gmap_modal_title: "Search & Add Restaurant via Google Maps",
    fs_gmap_input_placeholder: "Enter restaurant name or address (e.g. Popeyes Markham)...",
    fs_gmap_btn_search: "Search Google Maps",
    fs_gmap_search_hint: "Will query Google Places API across GTA and auto-populate fields",
    fs_gmap_searching: "Searching Google Maps...",
    fs_gmap_no_results: "No results found on Google Maps. You can manually enter details.",
    fs_gmap_btn_add: "Add & Link",

    // Analytics & Reports
    fs_analytics_title: "Field Sales Analytics & Performance Dashboard",
    fs_kpi_total_visits: "Total Visits",
    fs_kpi_signed_count: "Contracts Signed",
    fs_kpi_interested_count: "Interested Leads",
    fs_kpi_conversion_rate: "Conversion Rate",
    fs_kpi_onsite_ratio: "Onsite Visit %",
    fs_chart_outcomes_title: "Sales Outcomes Breakdown",
    fs_chart_reasons_title: "Rejection & Competitor Reasons Breakdown",
    fs_chart_trend_title: "Visit Activity Trend",
    fs_chart_methods_title: "Sales Method Performance",
    fs_chart_regions_title: "Regional Visit Distribution",
    fs_competitor_table_title: "Competitor Quotes & Intelligence",
    fs_btn_export_sales: "Export Sales Report (Excel/CSV)",

    // Map Explorer
    page_title_mapexplorer: "Map Explorer",
    nav_mapexplorer: "Map Explorer",
    map_filter_city: "Region / City",
    map_filter_neighborhood: "Neighborhood / Hub",
    map_filter_street: "Commercial Corridor / Street",
    map_filter_kv: "KV Database Status",
    map_follow_bounds: "Filter by map viewport",
    map_reset_view: "Reset View",
    map_select_area: "Select All Filtered",
    th_kv_status: "KV Status",
    filter_visited: "Visited Status",
    filter_outcome: "Visit Outcome",
    visited_all: "All (Visited & Unvisited)",
    visited_yes: "Visited",
    visited_no: "Not Visited",
    outcome_all: "All Outcomes",
    outcome_contract: "Contract Signed",
    outcome_interested: "Interested",
    outcome_considering: "Considering",
    outcome_not_interested: "Not Interested",
    outcome_rejected: "Rejected",
    outcome_closed: "Closed Down"
  },

  ko: {
    // Topbar & Global
    app_title: "Green Oil 워크벤치",
    page_title_restaurants: "식당 검색",
    page_title_calculator: "기름 계산기",
    page_title_greasetrap: "Grease Trap",
    nav_restaurants: "식당 검색",
    nav_calculator: "기름 계산기",
    nav_greasetrap: "Grease Trap",
    btn_logout: "로그아웃",
    status_connecting: "연결 중",
    status_online: "정상",
    status_offline: "오프라인",
    status_connected: "연결됨",
    status_disconnected: "미연결",
    confirm_logout: "로그아웃 하시겠습니까?",

    // Tab 1: Restaurant Search & Filters
    search_label: "검색",
    search_placeholder: "식당명, 주소, 키워드 검색...",
    region_label: "지역 선택",
    region_all: "전체 지역 (All GTA)",
    region_markham: "마컴 (Markham)",
    region_scarborough: "스카버러 (Scarborough)",
    region_north_york: "노스욕 (North York)",
    region_richmond_hill: "리치먼드 힐 (Richmond Hill)",
    region_downtown: "다운타운 토론토 (Downtown Toronto)",
    region_mississauga: "미시사가 (Mississauga)",
    region_vaughan: "본 (Vaughan)",
    sort_label: "정렬",
    sort_rating: "평점 높은 순",
    sort_reviews: "리뷰 많은 순",
    sort_name: "식당명 A-Z",
    btn_select_page: "페이지 전체 선택",
    btn_export_csv: "선택 항목 내보내기",
    cat_label: "업종 분류：",
    cat_all: "전체",
    cat_chinese: "중식/대만식 튀김",
    cat_western: "양식 치킨/패스트푸드",
    cat_korean: "한국식 치킨",
    cat_fish_chips: "피시 앤 칩스",
    cat_japanese: "일식 돈까스/튀김",
    cat_sweets: "핫도그/디저트",
    hub_label: "상권 / 쇼핑몰",
    hub_all: "전체 상권 및 쇼핑몰",
    view_card: "카드 뷰",
    view_table: "테이블 뷰",
    view_hubs: "상권 모아보기",
    view_list: "목록 보기",
    view_calendar: "달력 보기",
    btn_plan_route: "경로 계획",
    btn_add_to_route: "+ 경로 추가",
    btn_add_waypoint: "+ 경유지 추가",
    cal_prev_month: "이전 달",
    cal_next_month: "다음 달",
    cal_today: "오늘",
    cal_visits_count: "{count}회 방문",
    cal_no_visits: "이 날짜에 방문 기록이 없습니다",
    cal_btn_add_visit: "+ 이 날짜에 방문 기록",
    fs_route_saved_success: "경로가 클라우드에 동기화되었습니다",
    results_count: "총 {total}개 식당",
    no_matching_restaurants: "일치하는 식당이 없습니다",
    hub_card_count: "{count}개 식당",
    hub_card_oil: "월 예상 폐유 ~{liters}L ({drums}통)",
    hub_card_avg_rating: "평균 평점",
    hub_card_btn: "상권 내 식당 보기",

    // Table Headers
    th_name: "식당명",
    th_region: "지역",
    th_hub: "상권/쇼핑몰",
    th_category: "분류",
    th_rating: "평점 및 리뷰",
    th_status: "영업 상태",
    th_price: "가격대",
    th_address: "주소",
    th_phone: "전화번호",
    th_actions: "관리",

    // Status Values
    status_open: "영업 중",
    status_closed: "영업 종료",
    status_unknown: "정보 없음",

    // Card Action Buttons
    btn_calc_oil: "기름 계산",
    btn_calc_trap: "트랩 견적",
    btn_details: "상세보기",

    // Pagination
    page_info: "{page} / {totalPages} 페이지",
    pagination_range: "{start}-{end}번째 표시 중, 총 {total}개",
    page_size_label: "페이지당：",
    page_unit: "개",
    page_first: "첫 페이지",
    page_prev: "이전 페이지",
    page_next: "다음 페이지",
    page_last: "마지막 페이지",

    // Selection Bar
    sel_selected: "선택됨",
    sel_count: "{count}개 식당",
    btn_clear: "선택 해제",
    btn_clear_selection: "선택 해제",
    btn_export_selection: "선택 항목 내보내기 ({count}개)",

    // Detail Modal
    modal_title: "식당 상세정보",
    modal_cat: "업종 분류",
    modal_hub: "상권 / 쇼핑몰",
    modal_rating: "평점 및 리뷰",
    modal_address: "주소",
    modal_phone: "전화번호",
    modal_hours: "영업시간",
    modal_keywords: "키워드 및 업종",
    modal_place_id: "Place ID 및 좌표",
    btn_modal_call: "전화 걸기",
    btn_modal_website: "공식 웹사이트",
    btn_modal_maps: "구글 지도",
    btn_modal_import_oil: "기름 계산기로 가져오기",
    btn_modal_import_trap: "그리스 트랩 견적",
    hours_not_provided: "제공되지 않음",

    // Tab 2: Oil Calculator
    calc_fryer_params: "튀김기 파라미터",
    calc_linked_rest: "연결된 식당",
    calc_fryer_list: "튀김기 목록",
    calc_fryer_count_unit: "{count}개",
    btn_add_fryer: "튀김기 추가",
    calc_fryer_badge: "튀김기 #{index}",
    calc_capacity_placeholder: "용량",
    calc_unit_liter: "L",
    calc_unit_drum: "통",
    calc_freq_title: "교체 주기",
    calc_freq_prefix: "매",
    calc_freq_days_suffix: "일마다",
    calc_freq_times_suffix: "회,",
    calc_freq_fryers_suffix: "대 튀김기 기름 교체",
    btn_calc_oil_submit: "월간 사용량 계산",
    btn_calc_reset: "초기화",
    calc_res_title: "식용유 및 폐유 산정",
    calc_res_monthly_label: "예상 월간 총 식용유 사용량",
    calc_res_monthly_unit: "L / 월",
    calc_res_std_drums: "상업용 표준 캔 (16L)",
    calc_res_uco: "예상 폐유 수거량 (75%)",
    calc_res_200l_drums: "권장 수거용기 (Drum / Bin)",
    calc_res_baseline: "산정 기준",
    calc_res_30days: "30일 / 월",
    calc_res_advice_title: "수거 솔루션：",
    btn_copy_oil_quote: "산정 결과 복사",
    advice_drum_200: "200L Drum 1통 비치, 월간 또는 필요 시 수거 권장",
    advice_bin_400: "400L Bin 1대 비치, 3~4주마다 1회 수거 권장",
    advice_bin_600: "600L Bin 1대 비치, 2~3주마다 1회 수거 권장",
    advice_bin_800: "800L Bin 1대 비치, 1~2주마다 1회 수거 권장",
    advice_bin_1000: "1000L Bin 1대 비치, 매주 정기 수거 권장",
    advice_bin_multi: "1000L Bin {count}대 비치, 매주 고빈도 수거 권장",
    alert_at_least_one_fryer: "최소 1개 이상의 튀김기가 필요합니다",
    alert_invalid_input: "올바른 주기와 값을 입력해 주세요",
    alert_calc_first: "먼저 계산을 진행해 주세요",
    toast_copied_oil_quote: "식용유 산정 결과가 복사되었습니다",

    // Tab 3: Grease Trap Workbench
    trap_title: "그리스 트랩 청소 설정 (Grease Trap)",
    trap_count_label: "그리스 트랩 수량",
    trap_count_n: "{n}개",
    trap_size_label: "개별 트랩 용량 규격 (주단위: 미터법 L / 괄호: 갤런)",
    trap_freq_label: "권장 청소 주기",
    trap_freq_1: "매월 1회 (고객 밀집 식당 권장)",
    trap_freq_2: "2개월마다 1회 (표준 중대형 식당)",
    trap_freq_3: "분기별 1회 (3개월 / 지자체 법정 최소 기준)",
    trap_compliance_title: "지자체 환경 오염 규정 준수 안내",
    trap_compliance_body: "온타리오 광역 토론토 각 지자체(토론토 조례 Bylaw 560, 요크 지역 하수 조례 등)는 요식업소가 그리스 트랩을 의무 설치하고 인가된 전문 업체를 통해 정기적으로 흡입 세척할 것을 엄격히 규정하고 있습니다. 미준수 시 무거운 과태료가 부과될 수 있습니다.",
    btn_calc_trap_submit: "청소 비용 계산",
    btn_reset_trap: "초기화",
    trap_res_title: "그리스 트랩 청소 요금 안내 (온타리오 HST 13%)",
    trap_res_total_label: "1회 청소 부가세 포함 합계 (CAD)",
    trap_res_tax_badge: "13% HST 포함",
    trap_res_price_label: "세전 서비스 비용",
    trap_res_tax_label: "온타리오주 세금 (13% HST)",
    trap_res_spec_label: "현재 선택된 규격",
    trap_res_annual_label: "예상 연간 유지관리 비용",
    trap_per_year: "/ 년",
    trap_process_title: "Green Oil 표준 세척 공정 절차：",
    trap_process_body: "1. 상부 부유 유지류, 부유물 및 바닥 침전 오니 완전 흡입 배출<br>2. 고압 세척 및 트랩 내벽 고착 유지방 긁어내기 작업<br>3. 유입/유출 격벽 및 거름망 점검, 통수 확인 및 밀폐 복원",
    btn_copy_trap_quote: "그리스 트랩 견적서 복사",
    toast_copied_trap_quote: "그리스 트랩 견적서가 복사되었습니다",


    // Login Modal
    login_title: "Green Oil 워크벤치",
    login_username_label: "아이디",
    login_password_label: "비밀번호",
    login_submit: "로그인",
    login_error: "아이디 또는 비밀번호가 올바르지 않습니다",

    // Toast
    toast_export_excel: "Excel 내보내기 완료",
    toast_export_csv: "CSV 내보내기 완료",
    // Field Sale Workbench
    page_title_fieldsale: "현장 영업 (Field Sale)",
    nav_fieldsale: "현장 영업",
    fs_tab_route: "경로 계획",
    fs_tab_records: "영업 기록",
    fs_tab_analytics: "통계 보고서",

    // Route Planning
    fs_route_title: "현장 방문 경로 계획",
    fs_route_origin: "출발지 주소 (Green Oil Inc)",
    fs_route_origin_placeholder: "Green Oil Inc, Toronto, ON",
    fs_route_use_gps: "현재 GPS 위치를 출발지로 사용",
    fs_route_add_restaurant: "경로에 식당 추가",
    fs_route_search_placeholder: "식당명 또는 주소 검색 후 추가...",
    fs_route_stops: "경유 식당 ({count}개)",
    fs_route_empty: "경유 식당이 없습니다. 식당 목록에서 선택하거나 위에서 검색해 추가하세요.",
    fs_route_btn_go_query: "식당 검색에서 일괄 선택 가져오기 →",
    fs_route_btn_optimize: "스마트 최단 경로 정렬",
    fs_route_btn_clear: "경로 비우기",
    fs_route_btn_calc: "경로 생성",
    fs_route_btn_navigate: "Google 지도에서 내비게이션 시작",
    fs_route_dist_label: "예상 총 거리",
    fs_route_dur_label: "예상 운전 시간",
    fs_route_stops_label: "경유 식당 수",
    btn_plan_route: "경로 계획",
    btn_add_to_route: "경로 추가",

    // Sales Records
    btn_log_visit: "방문 기록",
    fs_record_btn_new: "+ 새 영업 기록",
    fs_record_title_new: "현장 영업 방문 기록",
    fs_record_title_edit: "영업 기록 수정",
    fs_record_select_rest: "연계 식당",
    fs_record_gps_prompt: "현재 경로 계획 기반 추천",
    fs_record_route_prompt: "🗺️ 현재 경로 계획의 정류장을 우선 추천합니다",
    fs_record_rest_not_found: "목록에 없습니까?",
    fs_record_btn_search_gmap: "Google 지도에서 검색 추가",
    fs_record_method: "영업 방식",
    fs_record_method_onsite: "현장 방문 (Onsite)",
    fs_record_method_phone: "전화 상담 (Phone)",
    fs_record_time: "방문 시간 (시간 단위)",
    fs_record_outcome: "영업 결과",
    fs_record_outcome_signed: "계약 체결",
    fs_record_outcome_interested: "관심 있음",
    fs_record_outcome_rejected: "거절",
    fs_record_outcome_signed_others: "타사 기계약",
    fs_reject_reason: "거절 사유",
    fs_reject_price: "가격 경쟁력 부족",
    fs_reject_hassle: "업체 변경 번거로움",
    fs_reject_decision_maker: "점주 부재/결정 불가",
    fs_reject_low_volume: "기름 사용량 극소 (회수 가치 없음)",
    fs_reject_satisfied: "기존 서비스 만족",
    fs_reject_other: "기타 사유",
    fs_reject_detail_placeholder: "거절 관련 상세 내용 입력...",
    fs_others_reason: "타사 선택 사유",
    fs_others_locked: "기존 장기 독점 계약 미만료",
    fs_others_equipment: "타사에서 전용 장비/고액 보조금 지원",
    fs_others_bundle: "타사 식자재 번들 공급",
    fs_others_other: "기타 사유",
    fs_competitor_quote_title: "경쟁사 견적 및 인텔리전스",
    fs_competitor_name: "타 공급업체명",
    fs_competitor_name_placeholder: "예: Darling, Rothsay 등",
    fs_competitor_quote: "경쟁사 견적/단가",
    fs_competitor_quote_placeholder: "예: $0.25/L 또는 통당 $45 또는 그리스 트랩 세척 무료 지원",
    fs_contract_expiry: "경쟁사 계약 만료 예정일",
    fs_notes: "상담 요약 / 다음 방문 계획",
    fs_notes_placeholder: "핵심 상담 내용, 사용량, 사장님 연락처 등...",
    fs_edit_rest_section: "식당 정보 확인/수정 (KV 자동 동기화)",
    fs_rest_phone: "전화번호",
    fs_rest_address: "상세 주소",
    fs_rest_contact: "담당자/사장님",
    fs_rest_sync_tip: "저장 시 식당 데이터베이스에 자동 반영됩니다",
    fs_btn_save: "영업 기록 저장",
    fs_record_saved_toast: "영업 기록이 성공적으로 저장되었습니다",
    fs_filter_all: "전체",
    fs_records_count: "총 {count}건의 영업 기록",
    fs_no_records: "영업 기록이 없습니다. 위 버튼을 눌러 추가하세요.",

    // Google Maps Search Modal
    fs_gmap_modal_title: "Google 지도에서 식당 검색 및 추가",
    fs_gmap_input_placeholder: "식당명 또는 주소 입력 (예: Popeyes Markham)...",
    fs_gmap_btn_search: "Google 지도 검색",
    fs_gmap_search_hint: "GTA 지역 Google Places API 검색을 통해 자동 입력됩니다",
    fs_gmap_searching: "Google 지도 검색 중...",
    fs_gmap_no_results: "일치하는 결과가 없습니다. 수동으로 입력할 수 있습니다.",
    fs_gmap_btn_add: "추가 및 연계",

    // Analytics & Reports
    fs_analytics_title: "현장 영업 통계 보고서 및 실적 대시보드",
    fs_kpi_total_visits: "총 방문 횟수",
    fs_kpi_signed_count: "계약 체결",
    fs_kpi_interested_count: "관심 고객",
    fs_kpi_conversion_rate: "계약 전환율",
    fs_kpi_onsite_ratio: "현장 방문 비율",
    fs_chart_outcomes_title: "영업 결과 분포",
    fs_chart_reasons_title: "거절 및 타사 유출 사유 분석",
    fs_chart_trend_title: "최근 방문 활동 추이",
    fs_chart_methods_title: "영업 방식별 성과 비교",
    fs_chart_regions_title: "지역별 방문 분포",
    fs_competitor_table_title: "경쟁사 견적 및 시장 인텔리전스",
    fs_btn_export_sales: "영업 보고서 내보내기 (Excel/CSV)",

    // Map Explorer
    page_title_mapexplorer: "지도 탐색",
    nav_mapexplorer: "지도 탐색",
    map_filter_city: "지역 / 도시",
    map_filter_neighborhood: "세부 지역 / 상권",
    map_filter_street: "주요 상업 거리",
    map_filter_kv: "KV 저장 상태",
    map_follow_bounds: "지도 시야 실시간 필터",
    map_reset_view: "시점 초기화",
    map_select_area: "현재 필터 전체 선택",
    th_kv_status: "KV 상태",
    filter_visited: "방문 여부",
    filter_outcome: "방문 결과",
    visited_all: "전체 (방문 여부)",
    visited_yes: "방문 완료",
    visited_no: "미방문",
    outcome_all: "전체 결과",
    outcome_contract: "계약 완료",
    outcome_interested: "관심 있음",
    outcome_considering: "고려 중",
    outcome_not_interested: "관심 없음",
    outcome_rejected: "거절",
    outcome_closed: "폐업/영업종료"
  }
};

class I18nManager {
  constructor() {
    this.currentLang = (typeof localStorage !== "undefined" && localStorage.getItem("greenoil_lang")) || "zh";
    if (!TRANSLATIONS[this.currentLang]) {
      this.currentLang = "zh";
    }
    this.listeners = [];
  }

  t(key, params = {}) {
    const langDict = TRANSLATIONS[this.currentLang] || TRANSLATIONS.zh;
    let text = langDict[key] || TRANSLATIONS.zh[key] || key;

    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
    return text;
  }

  getLanguage() {
    return this.currentLang;
  }

  setLanguage(lang) {
    if (!TRANSLATIONS[lang]) return;
    this.currentLang = lang;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("greenoil_lang", lang);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      this.updateDom();
    }
    this.notifyListeners();
  }

  onLanguageChange(fn) {
    this.listeners.push(fn);
  }

  notifyListeners() {
    for (const fn of this.listeners) {
      try {
        fn(this.currentLang);
      } catch (e) {
        console.error("i18n listener error:", e);
      }
    }
  }

  updateDom() {
    if (typeof document === "undefined") return;

    // 1. Text elements with data-i18n
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        el.textContent = this.t(key);
      }
    });

    // 2. HTML elements with data-i18n-html
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const key = el.getAttribute("data-i18n-html");
      if (key) {
        el.innerHTML = this.t(key);
      }
    });

    // 3. Placeholders with data-i18n-placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) {
        el.setAttribute("placeholder", this.t(key));
      }
    });

    // 4. Titles / aria-labels with data-i18n-title
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      if (key) {
        el.setAttribute("title", this.t(key));
      }
    });

    // 5. Update active page title in topbar
    const activeNav = document.querySelector(".nav-item.active");
    const pageTitleEl = document.getElementById("currentPageTitle");
    if (activeNav && pageTitleEl) {
      const titleKey = activeNav.getAttribute("data-title-key");
      if (titleKey) {
        pageTitleEl.textContent = this.t(titleKey);
      }
    }

    // 6. Update language selector active display
    const langSelect = document.getElementById("langSelect");
    if (langSelect) {
      langSelect.value = this.currentLang;
    }
  }

  init() {
    document.documentElement.lang = this.currentLang;
    this.updateDom();
  }
}

export const i18n = new I18nManager();
