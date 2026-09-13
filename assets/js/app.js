/**
 * Green Oil Workbench App Entry
 */

import { Auth } from "./auth.js";
import { Restaurants } from "./restaurants.js";
import { Calculator } from "./calculator.js";
import { GreaseTrap } from "./grease-trap.js";
import { FieldSales } from "./field-sales.js";
import { MapExplorer } from "./map-explorer.js";
import { i18n } from "./i18n.js";

// Global Toast Notification System
window.showToast = function(msg) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.style.cssText = `
      position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%);
      background: #0f172a; color: white; padding: 9px 18px; border-radius: 8px;
      font-size: 0.88rem; font-weight: 500; z-index: 9999; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      transition: opacity 0.2s ease, transform 0.2s ease; opacity: 0; pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";
  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(4px)";
  }, 2200);
};

export function initApp() {
  i18n.init();
  setupLanguageSwitcher();
  setupNavigation();
  setupSidebarCollapse();
  setupAuth();
  setupMobileMenu();

  Restaurants.init();
  Calculator.init();
  GreaseTrap.init();
  FieldSales.init();
  MapExplorer.init();
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

    if (targetTabId === "tab-mapexplorer") {
      setTimeout(() => {
        if (window.MapExplorer) {
          if (MapExplorer.googleMap && window.google && window.google.maps) {
            google.maps.event.trigger(MapExplorer.googleMap, "resize");
            MapExplorer.panToSelectedArea();
          }
          if (MapExplorer.fallbackMap && MapExplorer.fallbackMap.invalidateSize) {
            MapExplorer.fallbackMap.invalidateSize(true);
          }
        }
      }, 100);
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

function setupSidebarCollapse() {
  const container = document.querySelector(".app-container");
  const toggleBtns = document.querySelectorAll("#sidebarToggleBtn, #sidebarCollapseBtn");

  function updateToggleIcons(isCollapsed) {
    toggleBtns.forEach(btn => {
      btn.textContent = isCollapsed ? ">" : "<";
      btn.title = isCollapsed ? "展开侧边栏" : "折叠侧边栏";
    });
  }

  const savedState = localStorage.getItem("greenoil_sidebar_collapsed");
  if (savedState === "1" && window.innerWidth > 992 && container) {
    container.classList.add("sidebar-collapsed");
    updateToggleIcons(true);
  }

  function notifyWorkbenchResize() {
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new CustomEvent("greenoil:workbench-resize"));
    if (window.MapExplorer) {
      if (MapExplorer.googleMap && window.google && window.google.maps) {
        google.maps.event.trigger(MapExplorer.googleMap, "resize");
      }
      if (MapExplorer.fallbackMap && MapExplorer.fallbackMap.invalidateSize) {
        MapExplorer.fallbackMap.invalidateSize(true);
      }
    }
    if (window.FieldSales && FieldSales.activeSubTab === "analytics") {
      FieldSales.renderAnalytics();
    }
  }

  toggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!container) return;
      const isCollapsed = container.classList.toggle("sidebar-collapsed");
      updateToggleIcons(isCollapsed);
      try {
        localStorage.setItem("greenoil_sidebar_collapsed", isCollapsed ? "1" : "0");
      } catch (e) {}

      notifyWorkbenchResize();
      setTimeout(notifyWorkbenchResize, 260);
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
