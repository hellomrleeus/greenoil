/**
 * Green Oil Workbench App Entry
 */

import { Auth } from "./auth.js";
import { Restaurants } from "./restaurants.js";
import { Calculator } from "./calculator.js";
import { GreaseTrap } from "./grease-trap.js";
import { i18n } from "./i18n.js";

export function initApp() {
  i18n.init();
  setupLanguageSwitcher();
  setupNavigation();
  setupAuth();
  setupMobileMenu();

  Restaurants.init();
  Calculator.init();
  GreaseTrap.init();
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
