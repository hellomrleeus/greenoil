/**
 * Green Oil Authentication Manager
 * Handles fixed credential login, cookie generation & session persistence.
 */

import { Api } from "./api.js";

const AUTH_COOKIE_NAME = "greenoil_session";
const SESSION_DAYS = 7;

export const Auth = {
  /**
   * Helper to set cookie
   */
  setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    // SameSite=Lax for normal local/GitHub Pages session persistence
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
  },

  /**
   * Helper to get cookie
   */
  getCookie(name) {
    const cname = name + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === " ") {
        c = c.substring(1);
      }
      if (c.indexOf(cname) === 0) {
        return c.substring(cname.length, c.length);
      }
    }
    return "";
  },

  /**
   * Helper to delete cookie
   */
  deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax;`;
  },

  /**
   * Check if current session is authenticated
   */
  isAuthenticated() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("demo") === "1" || urlParams.get("auth") === "demo") {
        if (!localStorage.getItem("greenoil_auth_user")) {
          localStorage.setItem("greenoil_auth_user", "demo");
        }
        return true;
      }
    } catch (e) {}

    const cookieVal = this.getCookie(AUTH_COOKIE_NAME);
    const localVal = localStorage.getItem("greenoil_auth_user");
    return Boolean(cookieVal || localVal);
  },

  /**
   * Get current authenticated user
   */
  getUser() {
    return localStorage.getItem("greenoil_auth_user") || "操作员";
  },

  /**
   * Perform login via backend Cloudflare Worker with demo fallback
   */
  async login(username, password) {
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      return { success: false, error: "请输入账号和密码" };
    }

    try {
      const res = await Api.login(trimmedUser, trimmedPass);
      if (res && res.success) {
        const sessionToken = res.token || btoa(JSON.stringify({
          user: trimmedUser,
          loginAt: Date.now(),
          role: "operator"
        }));

        this.setCookie(AUTH_COOKIE_NAME, sessionToken, SESSION_DAYS);
        localStorage.setItem("greenoil_auth_user", trimmedUser);
        localStorage.setItem("greenoil_session_token", sessionToken);

        return { success: true, user: trimmedUser };
      }

      // Demo / fallback credentials for offline / local testing
      if ((trimmedUser === "demo" && trimmedPass === "demo") ||
          (trimmedUser === "admin" && trimmedPass === "admin") ||
          (trimmedUser === "greenoil" && trimmedPass === "greenoil2025")) {
        const sessionToken = btoa(JSON.stringify({
          user: trimmedUser,
          loginAt: Date.now(),
          role: "operator"
        }));
        this.setCookie(AUTH_COOKIE_NAME, sessionToken, SESSION_DAYS);
        localStorage.setItem("greenoil_auth_user", trimmedUser);
        localStorage.setItem("greenoil_session_token", sessionToken);
        return { success: true, user: trimmedUser };
      }

      return { success: false, error: res?.error || "账号或密码错误" };
    } catch (err) {
      if ((trimmedUser === "demo" && trimmedPass === "demo") ||
          (trimmedUser === "admin" && trimmedPass === "admin") ||
          (trimmedUser === "greenoil" && trimmedPass === "greenoil2025")) {
        const sessionToken = btoa(JSON.stringify({
          user: trimmedUser,
          loginAt: Date.now(),
          role: "operator"
        }));
        this.setCookie(AUTH_COOKIE_NAME, sessionToken, SESSION_DAYS);
        localStorage.setItem("greenoil_auth_user", trimmedUser);
        localStorage.setItem("greenoil_session_token", sessionToken);
        return { success: true, user: trimmedUser };
      }
      return { success: false, error: `登录服务异常: ${err.message}` };
    }
  },

  /**
   * Perform logout
   */
  logout() {
    this.deleteCookie(AUTH_COOKIE_NAME);
    localStorage.removeItem("greenoil_auth_user");
    localStorage.removeItem("greenoil_session_token");
  }
};
