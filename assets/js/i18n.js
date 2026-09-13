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
    page_title_settings: "系统设置",
    nav_restaurants: "餐馆查询",
    nav_calculator: "用油计算器",
    nav_greasetrap: "Grease Trap",
    nav_settings: "设置",
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
    view_card: "卡片视图",
    view_table: "表格视图",
    results_count: "共 {total} 家餐馆",
    no_matching_restaurants: "无匹配餐馆",

    // Table Headers
    th_name: "餐馆名称",
    th_region: "区域",
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
    btn_clear_selection: "清空",
    btn_export_selection: "导出所选 ({count} 家)",

    // Detail Modal
    modal_title: "餐馆详情",
    modal_cat: "分类",
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
    calc_res_200l_drums: "推荐回收桶配置 (200L)",
    calc_res_baseline: "计算基准",
    calc_res_30days: "30 天 / 月",
    calc_res_advice_title: "回收方案：",
    btn_copy_oil_quote: "复制测算结果",
    advice_1: "配置 1 个 200L 标准回收桶，每月回收 1 次",
    advice_2: "配置 1-2 个 200L 回收桶，每 2-3 周回收 1 次",
    advice_3: "配置 2-3 个 200L 回收桶，每 1-2 周回收 1 次",
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
    trap_process_body: "1. 彻底抽吸截留浮油、悬浮物与底部沉淀油泥<br>2. 高压冲洗四壁并刮擦油脂硬垢<br>3. 进出水隔板与过滤网疏通检查与密封还原<br>4. 出具市政认可的标准排污维保记录单（供年检备查）",
    btn_copy_trap_quote: "复制隔油池清洁报价单",
    toast_copied_trap_quote: "已复制隔油池清洁报价单",

    // Tab 4: Settings
    settings_title: "系统设置",
    settings_backend_label: "后端服务",
    settings_backend_status: "检测中...",
    settings_sync_title: "后台数据更新",
    settings_sync_desc: "当前数据源已全量深度采集大多伦多 2,585 家餐馆并直灌 Cloudflare KV 数据库，支持高并发秒级检索。",
    btn_trigger_sync: "立即同步",
    confirm_sync: "确定开始同步数据？",
    sync_in_progress: "同步中...",
    syncing: "正在同步...",
    sync_completed: "同步完成",
    sync_count: "已同步 {count} 条记录",
    sync_failed: "同步失败",
    sync_exception: "同步异常",
    cached_count_msg: "已缓存 {count} 条餐馆记录",
    backend_not_connected: "后端服务未连接",
    worker_online_count: "Cloudflare Worker 在线 ({count} 条)",
    worker_disconnected: "未连接后端服务",

    // Login Modal
    login_title: "Green Oil 工作台",
    login_username_label: "账号",
    login_password_label: "密码",
    login_submit: "登录",
    login_error: "账号或密码错误",

    // Toast
    toast_export_excel: "已导出 Excel",
    toast_export_csv: "已导出 CSV"
  },

  en: {
    // Topbar & Global
    app_title: "Green Oil Workbench",
    page_title_restaurants: "Restaurant Search",
    page_title_calculator: "Oil Calculator",
    page_title_greasetrap: "Grease Trap",
    page_title_settings: "System Settings",
    nav_restaurants: "Restaurants",
    nav_calculator: "Oil Calculator",
    nav_greasetrap: "Grease Trap",
    nav_settings: "Settings",
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
    view_card: "Cards",
    view_table: "Table",
    results_count: "Total {total} restaurants",
    no_matching_restaurants: "No matching restaurants found",

    // Table Headers
    th_name: "Name",
    th_region: "Region",
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
    btn_clear_selection: "Clear",
    btn_export_selection: "Export Selected ({count})",

    // Detail Modal
    modal_title: "Restaurant Details",
    modal_cat: "Category",
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
    calc_res_200l_drums: "Recommended Recycling Drum (200L)",
    calc_res_baseline: "Calculation Baseline",
    calc_res_30days: "30 Days / Mo",
    calc_res_advice_title: "Pickup Recommendation:",
    btn_copy_oil_quote: "Copy Estimate Results",
    advice_1: "Setup 1x 200L commercial drum, collect once a month",
    advice_2: "Setup 1-2x 200L commercial drums, collect every 2-3 weeks",
    advice_3: "Setup 2-3x 200L commercial drums, collect every 1-2 weeks",
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
    trap_process_body: "1. Complete pump-out of grease cap, suspended solids, and bottom sludge<br>2. High-pressure wall jetting and scraping<br>3. Baffle plate and filter screen clearance and seal restoration<br>4. Certified compliance maintenance manifest issued for municipal inspections",
    btn_copy_trap_quote: "Copy Grease Trap Quote",
    toast_copied_trap_quote: "Grease trap quote copied to clipboard",

    // Tab 4: Settings
    settings_title: "System Settings",
    settings_backend_label: "Backend Service",
    settings_backend_status: "Checking...",
    settings_sync_title: "Background Data Pipeline",
    settings_sync_desc: "2,585 fried food restaurants across GTA crawled locally and directly synced to Cloudflare KV for sub-second retrieval.",
    btn_trigger_sync: "Sync Now",
    confirm_sync: "Are you sure you want to start data sync?",
    sync_in_progress: "Syncing...",
    syncing: "Syncing in progress...",
    sync_completed: "Sync Completed",
    sync_count: "Synced {count} records",
    sync_failed: "Sync Failed",
    sync_exception: "Sync Error",
    cached_count_msg: "{count} restaurant records cached",
    backend_not_connected: "Backend service not connected",
    worker_online_count: "Cloudflare Worker Online ({count} items)",
    worker_disconnected: "Backend Disconnected",

    // Login Modal
    login_title: "Green Oil Workbench",
    login_username_label: "Username",
    login_password_label: "Password",
    login_submit: "Sign In",
    login_error: "Invalid username or password",

    // Toast
    toast_export_excel: "Excel Exported",
    toast_export_csv: "CSV Exported"
  },

  ko: {
    // Topbar & Global
    app_title: "Green Oil 워크벤치",
    page_title_restaurants: "식당 검색",
    page_title_calculator: "기름 계산기",
    page_title_greasetrap: "Grease Trap",
    page_title_settings: "시스템 설정",
    nav_restaurants: "식당 검색",
    nav_calculator: "기름 계산기",
    nav_greasetrap: "Grease Trap",
    nav_settings: "설정",
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
    view_card: "카드 뷰",
    view_table: "테이블 뷰",
    results_count: "총 {total}개 식당",
    no_matching_restaurants: "일치하는 식당이 없습니다",

    // Table Headers
    th_name: "식당명",
    th_region: "지역",
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
    btn_clear_selection: "선택 해제",
    btn_export_selection: "선택 항목 내보내기 ({count}개)",

    // Detail Modal
    modal_title: "식당 상세정보",
    modal_cat: "업종 분류",
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
    calc_res_200l_drums: "권장 200L 수거통 구성",
    calc_res_baseline: "산정 기준",
    calc_res_30days: "30일 / 월",
    calc_res_advice_title: "수거 솔루션：",
    btn_copy_oil_quote: "산정 결과 복사",
    advice_1: "200L 표준 수거통 1통 비치, 월 1회 수거 권장",
    advice_2: "200L 수거통 1~2통 비치, 2~3주마다 1회 수거 권장",
    advice_3: "200L 수거통 2~3통 비치, 1~2주마다 1회 수거 권장",
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
    trap_process_body: "1. 상부 부유 유지류, 부유물 및 바닥 침전 오니 완전 흡입 배출<br>2. 고압 세척 및 트랩 내벽 고착 유지방 긁어내기 작업<br>3. 유입/유출 격벽 및 거름망 점검, 통수 확인 및 밀폐 복원<br>4. 시청 위생·상하수도국 점검 대비 공식 작업 확인증(Service Manifest) 발급",
    btn_copy_trap_quote: "그리스 트랩 견적서 복사",
    toast_copied_trap_quote: "그리스 트랩 견적서가 복사되었습니다",

    // Tab 4: Settings
    settings_title: "시스템 설정",
    settings_backend_label: "백엔드 서비스",
    settings_backend_status: "확인 중...",
    settings_sync_title: "백그라운드 데이터 파이프라인",
    settings_sync_desc: "현재 데이터는 로컬 정밀 수집을 통해 Cloudflare KV에 직접 구축되었으며, 광역 토론토 2,585개 튀김 식당을 초고속으로 조회할 수 있습니다.",
    btn_trigger_sync: "지금 동기화",
    confirm_sync: "데이터 동기화를 시작하시겠습니까?",
    sync_in_progress: "동기화 중...",
    syncing: "동기화 진행 중...",
    sync_completed: "동기화 완료",
    sync_count: "{count}개 기록 동기화됨",
    sync_failed: "동기화 실패",
    sync_exception: "동기화 오류",
    cached_count_msg: "{count}개 식당 데이터 캐시됨",
    backend_not_connected: "백엔드 서비스 미연결",
    worker_online_count: "Cloudflare Worker 온라인 ({count}개)",
    worker_disconnected: "백엔드 미연결",

    // Login Modal
    login_title: "Green Oil 워크벤치",
    login_username_label: "아이디",
    login_password_label: "비밀번호",
    login_submit: "로그인",
    login_error: "아이디 또는 비밀번호가 올바르지 않습니다",

    // Toast
    toast_export_excel: "Excel 내보내기 완료",
    toast_export_csv: "CSV 내보내기 완료"
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
