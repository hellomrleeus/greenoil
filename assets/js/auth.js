/**
 * Green Oil Authentication Manager
 * Handles fixed credential login, cookie generation & session persistence.
 */

const AUTH_COOKIE_NAME = "greenoil_session";
const DEFAULT_USER = "greenoil";
const DEFAULT_PASS = "greenoil2025";
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
    const cookieVal = this.getCookie(AUTH_COOKIE_NAME);
    const localVal = localStorage.getItem("greenoil_auth_user");
    return Boolean(cookieVal || localVal);
  },

  /**
   * Get current authenticated user
   */
  getUser() {
    return localStorage.getItem("greenoil_auth_user") || DEFAULT_USER;
  },

  /**
   * Perform login
   */
  async login(username, password) {
    const customUser = localStorage.getItem("greenoil_custom_user") || DEFAULT_USER;
    const customPass = localStorage.getItem("greenoil_custom_pass") || DEFAULT_PASS;

    // Check fixed credentials
    if (username.trim() === customUser && password.trim() === customPass) {
      const sessionToken = btoa(JSON.stringify({
        user: username,
        loginAt: Date.now(),
        role: "operator"
      }));

      // Set cookie in browser as requested
      this.setCookie(AUTH_COOKIE_NAME, sessionToken, SESSION_DAYS);
      localStorage.setItem("greenoil_auth_user", username);
      localStorage.setItem("greenoil_session_token", sessionToken);

      return { success: true, user: username };
    }

    return { success: false, error: "账号或密码错误（默认账号: greenoil / 密码: greenoil2025）" };
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
