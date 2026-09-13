/**
 * Green Oil Workbench App Entry
 */

import { Auth } from "./auth.js";
import { Api } from "./api.js";
import { Restaurants } from "./restaurants.js";
import { Calculator } from "./calculator.js";

export function initApp() {
  setupNavigation();
  setupAuth();
  setupMobileMenu();
  setupSettings();

  Restaurants.init();
  Calculator.init();

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
      pageTitleEl.textContent = activeItem.dataset.title || "Green Oil";
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
        await checkApiStatus();
        Restaurants.fetchData();
      } else {
        if (loginAlert) {
          loginAlert.textContent = res.error || "账号或密码错误";
          loginAlert.style.display = "block";
        }
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      if (confirm("确定退出登录？")) {
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
  const btnTriggerSync = document.getElementById("btnTriggerSync");
  const syncStatusText = document.getElementById("syncStatusText");

  if (btnTriggerSync) {
    btnTriggerSync.addEventListener("click", async () => {
      if (!confirm("确定开始同步数据？")) {
        return;
      }

      btnTriggerSync.disabled = true;
      btnTriggerSync.innerHTML = "<span>同步中...</span>";
      if (syncStatusText) syncStatusText.textContent = "正在同步...";

      try {
        const res = await Api.triggerSync();
        if (res.success) {
          alert("同步完成");
          if (syncStatusText) syncStatusText.textContent = `已同步 ${res.totalRecords} 条记录`;
          Restaurants.fetchData();
        } else {
          alert(`同步失败: ${res.message || ''}`);
          if (syncStatusText) syncStatusText.textContent = `失败: ${res.message}`;
        }
      } catch (err) {
        alert(`同步异常: ${err.message}`);
        if (syncStatusText) syncStatusText.textContent = `失败: ${err.message}`;
      } finally {
        btnTriggerSync.disabled = false;
        btnTriggerSync.innerHTML = "<span>立即同步</span>";
      }
    });
  }
}

async function checkApiStatus() {
  const badge = document.getElementById("apiStatusBadge");
  const syncStatusText = document.getElementById("syncStatusText");
  const settingsWorkerStatus = document.getElementById("settingsWorkerStatus");
  if (!badge) return;

  const status = await Api.getCacheStatus();
  if (status) {
    badge.innerHTML = `<span class="dot"></span><span>已连接</span>`;
    badge.style.color = "var(--primary)";
    badge.style.borderColor = "rgba(5, 150, 105, 0.3)";
    if (syncStatusText) {
      syncStatusText.textContent = `已缓存 ${status.cachedCount} 条餐馆记录`;
    }
    if (settingsWorkerStatus) {
      settingsWorkerStatus.textContent = `Cloudflare Worker 在线 (${status.cachedCount} 条)`;
      settingsWorkerStatus.style.background = "#ecfdf5";
      settingsWorkerStatus.style.color = "#047857";
      settingsWorkerStatus.style.borderColor = "rgba(5, 150, 105, 0.3)";
    }
  } else {
    badge.innerHTML = `<span class="dot" style="background:#f59e0b;"></span><span>离线模式</span>`;
    badge.style.color = "#d97706";
    badge.style.borderColor = "rgba(245, 158, 11, 0.3)";
    if (syncStatusText) {
      syncStatusText.textContent = "离线模式 (608 条餐馆记录)";
    }
    if (settingsWorkerStatus) {
      settingsWorkerStatus.textContent = "离线本地模式";
      settingsWorkerStatus.style.background = "#fffbeb";
      settingsWorkerStatus.style.color = "#d97706";
      settingsWorkerStatus.style.borderColor = "rgba(245, 158, 11, 0.3)";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
