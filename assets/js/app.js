/**
 * Green Oil Workbench App Entry
 */

import { Auth } from "./auth.js";
import { Api } from "./api.js";
import { Restaurants } from "./restaurants.js";
import { Calculator } from "./calculator.js";

export function initApp() {
  // Setup tabs
  setupNavigation();

  // Setup login modal & auth guard
  setupAuth();

  // Setup mobile sidebar
  setupMobileMenu();

  // Setup settings & manual sync
  setupSettings();

  // Initialize features
  Restaurants.init();
  Calculator.init();

  // Check Worker API health
  checkApiStatus();
}

function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabViews = document.querySelectorAll(".tab-view");

  window.switchTab = function(targetTabId) {
    navItems.forEach(item => {
      if (item.dataset.tab === targetTabId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    tabViews.forEach(view => {
      if (view.id === targetTabId) {
        view.classList.add("active");
      } else {
        view.classList.remove("active");
      }
    });

    const activeItem = document.querySelector(`.nav-item[data-tab="${targetTabId}"]`);
    const pageTitleEl = document.getElementById("currentPageTitle");
    if (activeItem && pageTitleEl) {
      pageTitleEl.textContent = activeItem.dataset.title || "Green Oil 工作台";
    }

    closeMobileSidebar();
  };

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tabId = item.dataset.tab;
      window.switchTab(tabId);
    });
  });
}

function setupAuth() {
  const loginOverlay = document.getElementById("loginOverlay");
  const loginForm = document.getElementById("loginForm");
  const loginAlert = document.getElementById("loginAlert");
  const btnLogout = document.getElementById("btnLogout");
  const userDisplay = document.getElementById("sidebarUserName");

  function checkAndRenderAuth() {
    if (Auth.isAuthenticated()) {
      if (loginOverlay) loginOverlay.classList.remove("active");
      if (userDisplay) userDisplay.textContent = Auth.getUser();
    } else {
      if (loginOverlay) loginOverlay.classList.add("active");
    }
  }

  checkAndRenderAuth();

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("loginUsername").value;
      const password = document.getElementById("loginPassword").value;

      const res = await Auth.login(username, password);
      if (res.success) {
        if (loginAlert) loginAlert.style.display = "none";
        checkAndRenderAuth();
      } else {
        if (loginAlert) {
          loginAlert.textContent = res.error;
          loginAlert.style.display = "block";
        }
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      if (confirm("确定要退出登录吗？")) {
        Auth.logout();
        checkAndRenderAuth();
      }
    });
  }
}

function setupMobileMenu() {
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");

  if (mobileMenuBtn && sidebar && backdrop) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.add("open");
      backdrop.classList.add("active");
    });

    backdrop.addEventListener("click", () => {
      closeMobileSidebar();
    });
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar) sidebar.classList.remove("open");
  if (backdrop) backdrop.classList.remove("active");
}

function setupSettings() {
  const workerInput = document.getElementById("settingWorkerUrl");
  const btnSave = document.getElementById("btnSaveSettings");
  const btnTriggerSync = document.getElementById("btnTriggerSync");
  const syncStatusText = document.getElementById("syncStatusText");

  if (workerInput) {
    workerInput.value = Api.getWorkerUrl();
  }

  if (btnSave && workerInput) {
    btnSave.addEventListener("click", async () => {
      Api.setWorkerUrl(workerInput.value);
      alert("设置已保存！正在检测 Worker API 连通性...");
      await checkApiStatus();
      Restaurants.fetchData();
    });
  }

  if (btnTriggerSync) {
    btnTriggerSync.addEventListener("click", async () => {
      if (!confirm("确定要立即触发后台全量向 Google Maps API 抓取同步吗？\n(日常情况下每天夜间会自动更新一次，无需频繁同步)")) {
        return;
      }

      btnTriggerSync.disabled = true;
      btnTriggerSync.innerHTML = "<span>⏳ 正在后台同步中...</span>";
      if (syncStatusText) syncStatusText.textContent = "正在调用 Google Maps API 抓取大多伦多各区域并刷新后端缓存...";

      try {
        const res = await Api.triggerSync();
        if (res.success) {
          alert(`✅ 后台同步完成！共更新 ${res.totalRecords} 条餐馆记录，新增检索 ${res.newlyFetched} 条。`);
          if (syncStatusText) syncStatusText.textContent = `最后同步时间: ${res.syncedAt} (共 ${res.totalRecords} 条记录)`;
          Restaurants.fetchData();
        } else {
          alert(`同步提示: ${res.message || '未成功'}`);
          if (syncStatusText) syncStatusText.textContent = `提示: ${res.message}`;
        }
      } catch (err) {
        alert(`同步异常: ${err.message}`);
        if (syncStatusText) syncStatusText.textContent = `同步失败: ${err.message}`;
      } finally {
        btnTriggerSync.disabled = false;
        btnTriggerSync.innerHTML = "<span>🔄 立即手动触发全量更新</span>";
      }
    });
  }
}

async function checkApiStatus() {
  const badge = document.getElementById("apiStatusBadge");
  const syncStatusText = document.getElementById("syncStatusText");
  if (!badge) return;

  const status = await Api.getCacheStatus();
  if (status) {
    badge.innerHTML = `<span class="dot"></span><span>Worker 后端缓存已连接</span>`;
    badge.style.color = "var(--primary)";
    badge.style.borderColor = "rgba(5, 150, 105, 0.3)";
    if (syncStatusText) {
      syncStatusText.textContent = `后端缓存状态: 正常 (已缓存 ${status.cachedCount} 条餐馆，定时任务: ${status.cronSchedule})`;
    }
  } else {
    badge.innerHTML = `<span class="dot" style="background:#f59e0b;"></span><span>离线高速模式 (608 家)</span>`;
    badge.style.color = "#d97706";
    badge.style.borderColor = "rgba(245, 158, 11, 0.3)";
    if (syncStatusText) {
      syncStatusText.textContent = "当前使用前端离线数据库 (608 家餐馆)。待部署 Cloudflare Worker 后将开启每日自动同步。";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
