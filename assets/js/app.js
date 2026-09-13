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

  // Setup settings
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

    // Update page title
    const activeItem = document.querySelector(`.nav-item[data-tab="${targetTabId}"]`);
    const pageTitleEl = document.getElementById("currentPageTitle");
    if (activeItem && pageTitleEl) {
      pageTitleEl.textContent = activeItem.dataset.title || "Green Oil 工作台";
    }

    // Close mobile sidebar if open
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

  // Initial check
  checkAndRenderAuth();

  // Login form submit
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

  // Logout button
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
  if (workerInput) {
    workerInput.value = Api.getWorkerUrl();
  }

  if (btnSave && workerInput) {
    btnSave.addEventListener("click", () => {
      Api.setWorkerUrl(workerInput.value);
      alert("设置已保存！正在检测 Worker API 连通性...");
      checkApiStatus();
    });
  }
}

async function checkApiStatus() {
  const badge = document.getElementById("apiStatusBadge");
  if (!badge) return;

  const isHealthy = await Api.checkWorkerHealth();
  if (isHealthy) {
    badge.innerHTML = `<span class="dot"></span><span>Worker 已连接</span>`;
    badge.style.color = "var(--primary)";
    badge.style.borderColor = "rgba(5, 150, 105, 0.3)";
  } else {
    badge.innerHTML = `<span class="dot" style="background:#f59e0b;"></span><span>离线数据库模式</span>`;
    badge.style.color = "#d97706";
    badge.style.borderColor = "rgba(245, 158, 11, 0.3)";
  }
}

// Auto start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
