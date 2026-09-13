/**
 * Green Oil Workbench App Entry
 */

import { Auth } from "./auth.js";
import { Api } from "./api.js";
import { Restaurants } from "./restaurants.js";
import { Calculator } from "./calculator.js";
import { GreaseTrap } from "./grease-trap.js";
import { i18n } from "./i18n.js";

let lastApiStatus = null;

export function initApp() {
  i18n.init();
  setupLanguageSwitcher();
  setupNavigation();
  setupAuth();
  setupMobileMenu();
  setupSettings();

  Restaurants.init();
  Calculator.init();
  GreaseTrap.init();

  checkApiStatus();

  i18n.onLanguageChange(() => {
    updateApiStatusDisplay(lastApiStatus);
  });
}

function setupLanguageSwitcher() {
  const langSelect = document.getElementById("langSelect");
  if (langSelect) {
    langSelect.value = i18n.getLanguage();
    langSelect.addEventListener("change", (e) => {
      i18n.setLanguage(e.target.value);
    });
  }
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
      const titleKey = activeItem.getAttribute("data-title-key");
      pageTitleEl.textContent = titleKey ? i18n.t(titleKey) : (activeItem.dataset.title || "Green Oil");
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
          loginAlert.textContent = res.error || i18n.t("login_error");
          loginAlert.style.display = "block";
        }
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      if (confirm(i18n.t("confirm_logout"))) {
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
      if (!confirm(i18n.t("confirm_sync"))) {
        return;
      }

      btnTriggerSync.disabled = true;
      btnTriggerSync.innerHTML = `<span>${i18n.t("sync_in_progress")}</span>`;
      if (syncStatusText) syncStatusText.textContent = i18n.t("syncing");

      try {
        const res = await Api.triggerSync();
        if (res.success) {
          alert(i18n.t("sync_completed"));
          if (syncStatusText) syncStatusText.textContent = i18n.t("sync_count", { count: res.totalRecords });
          Restaurants.fetchData();
        } else {
          alert(`${i18n.t("sync_failed")}: ${res.message || ''}`);
          if (syncStatusText) syncStatusText.textContent = `${i18n.t("sync_failed")}: ${res.message}`;
        }
      } catch (err) {
        alert(`${i18n.t("sync_exception")}: ${err.message}`);
        if (syncStatusText) syncStatusText.textContent = `${i18n.t("sync_exception")}: ${err.message}`;
      } finally {
        btnTriggerSync.disabled = false;
        btnTriggerSync.innerHTML = `<span>${i18n.t("btn_trigger_sync")}</span>`;
      }
    });
  }
}

async function checkApiStatus() {
  const status = await Api.getCacheStatus();
  lastApiStatus = status;
  updateApiStatusDisplay(status);
}

function updateApiStatusDisplay(status) {
  const badge = document.getElementById("apiStatusBadge");
  const syncStatusText = document.getElementById("syncStatusText");
  const settingsWorkerStatus = document.getElementById("settingsWorkerStatus");
  if (!badge) return;

  if (status) {
    badge.innerHTML = `<span class="dot"></span><span>${i18n.t("status_connected")}</span>`;
    badge.style.color = "var(--primary)";
    badge.style.borderColor = "rgba(5, 150, 105, 0.3)";
    if (syncStatusText) {
      syncStatusText.textContent = i18n.t("cached_count_msg", { count: status.cachedCount });
    }
    if (settingsWorkerStatus) {
      settingsWorkerStatus.textContent = i18n.t("worker_online_count", { count: status.cachedCount });
      settingsWorkerStatus.style.background = "#ecfdf5";
      settingsWorkerStatus.style.color = "#047857";
      settingsWorkerStatus.style.borderColor = "rgba(5, 150, 105, 0.3)";
    }
  } else {
    badge.innerHTML = `<span class="dot" style="background:#f59e0b;"></span><span>${i18n.t("status_disconnected")}</span>`;
    badge.style.color = "#d97706";
    badge.style.borderColor = "rgba(245, 158, 11, 0.3)";
    if (syncStatusText) {
      syncStatusText.textContent = i18n.t("backend_not_connected");
    }
    if (settingsWorkerStatus) {
      settingsWorkerStatus.textContent = i18n.t("worker_disconnected");
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
