/**
 * Green Oil Business Hours Parser & Real-Time Status Engine
 * High-precision bilingual (Chinese & English) business hours parser and status evaluator.
 *
 * Rules:
 * - 未提供营业时间 (Missing / Not provided) -> "未知" (status-unknown)
 * - 未到营业时间 / 已过营业时间 / 休息 (Closed) -> "已打烊" (status-closed)
 * - 营业中 (Open) -> "剩XX小时打烊" (status-open) / 24小时营业
 *
 * Supported formats:
 * - Chinese: 星期一至星期日 / 周一至周日, 16:00–00:00, 16:00–01:30, 休息, 24小时营业
 * - English: Monday–Sunday / Mon–Sun, 11:00 AM – 11:00 PM, 11am - 10pm, Closed, Open 24 hours
 * - Range grouping: "Monday - Friday: 9:00 AM - 5:00 PM", "Daily: 11:00 AM - 10:00 PM"
 * - Split shifts: "11:30 AM – 2:30 PM, 5:00 PM – 10:00 PM"
 * - Overnight / Cross-midnight: "16:00–01:30", "11:00 PM – 2:00 AM", "16:00–00:00"
 * - Local Timezone: America/Toronto (Eastern Time with automatic DST handling)
 */

const SINGLE_DAYS = [
  { days: [1], pattern: /^(?:monday|mon\.?|星期一|周一)$/i },
  { days: [2], pattern: /^(?:tuesday|tue\.?|tues\.?|星期二|周二)$/i },
  { days: [3], pattern: /^(?:wednesday|wed\.?|星期三|周三)$/i },
  { days: [4], pattern: /^(?:thursday|thu\.?|thur\.?|thurs\.?|星期四|周四)$/i },
  { days: [5], pattern: /^(?:friday|fri\.?|星期五|周五)$/i },
  { days: [6], pattern: /^(?:saturday|sat\.?|星期六|周六)$/i },
  { days: [0], pattern: /^(?:sunday|sun\.?|星期日|星期天|周日|周天)$/i }
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const DAY_CODE_MAP = {
  "mon": 1, "monday": 1, "一": 1,
  "tue": 2, "tues": 2, "tuesday": 2, "二": 2,
  "wed": 3, "wednesday": 3, "三": 3,
  "thu": 4, "thur": 4, "thurs": 4, "thursday": 4, "四": 4,
  "fri": 5, "friday": 5, "五": 5,
  "sat": 6, "saturday": 6, "六": 6,
  "sun": 0, "sunday": 0, "日": 0, "天": 0
};

export const BusinessHours = {
  /**
   * Parses day string into an array of day indices [0..6] (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
   * Supports single days ("Monday", "星期一"), ranges ("Mon - Fri", "周一至周五"), and "Daily"/"Everyday".
   */
  parseDayString(rawDay) {
    const s = (rawDay || "").trim().toLowerCase().replace(/\./g, "");
    if (!s) return [];

    if (/^(?:daily|everyday|every\s*day|每天|天天|7\s*days)$/i.test(s)) {
      return ALL_DAYS;
    }

    // Single day check
    for (const item of SINGLE_DAYS) {
      if (item.pattern.test(s)) {
        return item.days;
      }
    }

    // Range check: e.g. "Monday - Friday", "Mon-Fri", "周一至周五", "Mon to Sun"
    const rangeMatch = s.match(/^([a-z\u4e00-\u9fa5]+)\s*(?:[–—\-~至到]|\bto\b)\s*([a-z\u4e00-\u9fa5]+)$/i);
    if (rangeMatch) {
      const startStr = rangeMatch[1].replace(/星期|周/, "").trim();
      const endStr = rangeMatch[2].replace(/星期|周/, "").trim();

      let startDay = null;
      let endDay = null;

      for (const [k, v] of Object.entries(DAY_CODE_MAP)) {
        if (startStr === k || startStr.startsWith(k)) { startDay = v; break; }
      }
      for (const [k, v] of Object.entries(DAY_CODE_MAP)) {
        if (endStr === k || endStr.startsWith(k)) { endDay = v; break; }
      }

      if (startDay !== null && endDay !== null) {
        const days = [];
        let curr = startDay;
        while (true) {
          days.push(curr);
          if (curr === endDay) break;
          curr = (curr + 1) % 7;
        }
        return days;
      }
    }

    return [];
  },

  /**
   * Parses a single time token into minutes from midnight (0..1440).
   * Handles:
   * - 24-hour: "16:00", "09:30", "00:00", "24:00"
   * - 12-hour AM/PM: "11:00 AM", "11am", "11:30 PM", "12:00 AM", "12:00 PM", "12 AM", "12 PM"
   * - Words: "noon", "midnight"
   */
  parseTimeToMinutes(rawToken, isEndTime = false, startMinutes = null) {
    if (!rawToken) return null;
    const s = rawToken.trim().toLowerCase();

    if (s === "noon") return 720;
    if (s === "midnight") return isEndTime ? 1440 : 0;

    // 12-hour AM/PM: e.g. "11:00 AM", "11:00am", "11 AM", "11am", "11:30p.m."
    const ampmMatch = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.m\.?|p\.m\.?|am|pm)$/i);
    if (ampmMatch) {
      let hour = parseInt(ampmMatch[1], 10);
      const minute = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
      const isPm = ampmMatch[3].startsWith("p");

      if (hour > 12 || minute >= 60) return null;

      if (isPm) {
        if (hour < 12) hour += 12; // 1 PM -> 13:00, 12 PM -> 12:00 (noon)
      } else {
        if (hour === 12) {
          // 12:00 AM as end time indicates midnight at the end of the shift (1440 mins)
          if (isEndTime && (startMinutes === null || startMinutes > 0)) {
            return 1440;
          }
          hour = 0; // 00:00 start of day
        }
      }
      return hour * 60 + minute;
    }

    // 24-hour: e.g. "16:00", "09:30", "0:00", "24:00"
    const h24Match = s.match(/^(\d{1,2}):(\d{2})$/);
    if (h24Match) {
      const hour = parseInt(h24Match[1], 10);
      const minute = parseInt(h24Match[2], 10);
      if (hour === 24 && minute === 0) return 1440;
      if (hour === 0 && minute === 0 && isEndTime) return 1440; // 00:00 as end time = 24:00 midnight
      if (hour < 24 && minute < 60) return hour * 60 + minute;
    }

    return null;
  },

  /**
   * Format minutes into readable 24-hour string "HH:MM"
   */
  minutesToTimeStr(min) {
    if (min === 1440 || min === 0) return "00:00";
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  },

  /**
   * Parses full opening hours text into structured day schedules.
   * Supports Chinese, English, bilingual, 12-hour AM/PM, 24-hour, split shifts, and 24h open.
   *
   * @param {string} text - Raw opening hours text
   * @returns {Object|null} Map of dayIndex (0=Sun..6=Sat) -> Array of shifts
   */
  parseOpeningHours(text) {
    if (!text || typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!trimmed || /^(?:未提供|未知|not provided|unknown|暂无|none|null|n\/a)$/i.test(trimmed)) {
      return null;
    }

    const schedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const lines = trimmed.split(/\r?\n/);
    let hasValidEntries = false;
    let hasRecognizedDays = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const colonIdx = line.search(/[:：]/);
      if (colonIdx === -1) continue;

      const dayPart = line.substring(0, colonIdx).trim();
      const valPart = line.substring(colonIdx + 1).trim();

      const matchedDays = this.parseDayString(dayPart);
      if (matchedDays.length === 0) continue;
      hasRecognizedDays = true;

      // Multiple ranges separated by comma or semicolon
      const subRanges = valPart.split(/[,，;；]/);
      for (let sub of subRanges) {
        sub = sub.trim();
        if (!sub) continue;

        // Closed checks
        if (/^(?:closed|close|off|day off|休息|打烊|不营业)$/i.test(sub) || /closed|休息/i.test(sub)) {
          continue;
        }

        // 24-hour checks
        if (/24\s*(?:hours|小时)|open\s*24|全天营业|24\/7/i.test(sub)) {
          for (const d of matchedDays) {
            schedule[d].push({ start: 0, end: 1440, is24h: true, isOvernight: false, closeStr: "24h" });
          }
          hasValidEntries = true;
          continue;
        }

        // Range separator: " - ", "–", "—", "~", " to ", " 至 ", " 到 "
        const rangeParts = sub.split(/\s*(?:[–—\-~至到]|\bto\b|\buntil\b)\s*/i);
        if (rangeParts.length === 2) {
          const startMin = this.parseTimeToMinutes(rangeParts[0], false, null);
          const endMin = this.parseTimeToMinutes(rangeParts[1], true, startMin);

          if (startMin !== null && endMin !== null) {
            const closeStr = this.minutesToTimeStr(endMin);
            if (endMin <= startMin) {
              // Overnight shift (cross-midnight)
              for (const d of matchedDays) {
                schedule[d].push({ start: startMin, end: endMin, is24h: false, isOvernight: true, closeStr });
              }
            } else {
              // Normal daytime shift
              for (const d of matchedDays) {
                schedule[d].push({ start: startMin, end: endMin, is24h: false, isOvernight: false, closeStr });
              }
            }
            hasValidEntries = true;
          }
        }
      }
    }

    return (hasValidEntries || hasRecognizedDays) ? schedule : null;
  },

  /**
   * Get current DateTime in America/Toronto local timezone.
   * Ensures accurate results regardless of the client user's machine timezone.
   *
   * @param {Date|null} customDate - Optional custom Date object
   * @returns {Date}
   */
  getTorontoDateTime(customDate = null) {
    const baseDate = (customDate instanceof Date && !isNaN(customDate.getTime())) ? customDate : new Date();
    try {
      const torontoStr = baseDate.toLocaleString("en-US", { timeZone: "America/Toronto" });
      return new Date(torontoStr);
    } catch {
      return baseDate;
    }
  },

  /**
   * Evaluates the real-time business status of a restaurant.
   *
   * @param {string} openingHours - Raw opening hours text (Chinese, English, or mixed)
   * @param {Date|null} [customDate=null] - Date to evaluate against (defaults to current Toronto time)
   * @param {Object} [options={}] - Options { lang: "zh" | "en" | "ko", compact: boolean }
   * @returns {Object} Result object:
   *   - status: "未知" | "已打烊" | "营业中"
   *   - label: formatted status badge text, e.g. "剩4小时30分打烊" | "24小时营业" | "已打烊" | "未知"
   *   - compactLabel: e.g. "剩5小时打烊"
   *   - cls: "status-unknown" | "status-closed" | "status-open"
   *   - remainingMinutes: number | null
   *   - remainingHours: number | null
   *   - is24h: boolean
   *   - closeTime: string | null (e.g. "22:00")
   */
  getBusinessStatus(openingHours, customDate = null, options = {}) {
    const schedule = this.parseOpeningHours(openingHours);
    const lang = options.lang || (typeof window !== "undefined" && window.i18n ? window.i18n.currentLang : "zh");

    if (!schedule) {
      const label = (typeof window !== "undefined" && window.i18n)
        ? window.i18n.t("status_unknown")
        : (lang === "en" ? "Unknown" : (lang === "ko" ? "정보 없음" : "未知"));
      return {
        status: "未知",
        statusKey: "status_unknown",
        label,
        compactLabel: label,
        cls: "status-unknown",
        remainingMinutes: null,
        remainingHours: null,
        is24h: false,
        closeTime: null
      };
    }

    const dt = this.getTorontoDateTime(customDate);
    const todayIdx = dt.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const yesterdayIdx = (todayIdx + 6) % 7;
    const nowMin = dt.getHours() * 60 + dt.getMinutes();

    // 1. Check if yesterday had an overnight shift that extends into today's early morning
    const yesterdayShifts = schedule[yesterdayIdx] || [];
    for (const shift of yesterdayShifts) {
      if (shift.isOvernight && nowMin < shift.end) {
        const remMinutes = shift.end - nowMin;
        return this.formatOpenStatus(remMinutes, false, shift.closeStr, { ...options, lang });
      }
    }

    // 2. Check today's active shifts
    const todayShifts = schedule[todayIdx] || [];
    for (const shift of todayShifts) {
      if (shift.is24h) {
        return this.formatOpenStatus(null, true, null, { ...options, lang });
      }

      if (shift.isOvernight) {
        // Starts today at shift.start and runs past midnight until shift.end tomorrow
        if (nowMin >= shift.start) {
          const remMinutes = (1440 - nowMin) + shift.end;
          return this.formatOpenStatus(remMinutes, false, shift.closeStr, { ...options, lang });
        }
      } else {
        // Normal daytime shift
        if (shift.start <= nowMin && nowMin < shift.end) {
          const remMinutes = shift.end - nowMin;
          return this.formatOpenStatus(remMinutes, false, shift.closeStr, { ...options, lang });
        }
      }
    }

    // 3. If currently closed, find next upcoming opening shift
    let nextShift = null;
    let remMinutesUntilOpen = null;

    // 3a. Check later shifts today
    const laterShiftsToday = todayShifts.filter(s => s.start > nowMin).sort((a, b) => a.start - b.start);
    if (laterShiftsToday.length > 0) {
      nextShift = laterShiftsToday[0];
      remMinutesUntilOpen = nextShift.start - nowMin;
    } else {
      // 3b. Check upcoming days (up to 7 days)
      for (let offset = 1; offset <= 7; offset++) {
        const nextDayIdx = (todayIdx + offset) % 7;
        const nextDayShifts = (schedule[nextDayIdx] || []).filter(s => !s.isClosed).sort((a, b) => a.start - b.start);
        if (nextDayShifts.length > 0) {
          nextShift = nextDayShifts[0];
          remMinutesUntilOpen = (1440 - nowMin) + (offset - 1) * 1440 + (nextShift.is24h ? 0 : nextShift.start);
          break;
        }
      }
    }

    // If opens within next 24 hours, format as "剩XX开业"
    if (remMinutesUntilOpen !== null && remMinutesUntilOpen <= 24 * 60) {
      const openTimeStr = nextShift ? (nextShift.openStr || (nextShift.is24h ? "00:00" : null)) : null;
      return this.formatOpeningSoonStatus(remMinutesUntilOpen, openTimeStr, { ...options, lang });
    }

    // Otherwise standard closed status
    const closedLabel = (typeof window !== "undefined" && window.i18n)
      ? window.i18n.t("status_closed")
      : (lang === "en" ? "Closed" : (lang === "ko" ? "영업 종료" : "已打烊"));
    return {
      status: "已打烊",
      statusKey: "status_closed",
      label: closedLabel,
      compactLabel: closedLabel,
      cls: "status-closed",
      remainingMinutes: null,
      remainingHours: null,
      is24h: false,
      closeTime: null
    };
  },

  /**
   * Format opening soon status details and countdown text.
   */
  formatOpeningSoonStatus(remMinutes, openStr, options = {}) {
    const lang = options.lang || (typeof window !== "undefined" && window.i18n ? window.i18n.currentLang : "zh");

    const hours = Math.floor(remMinutes / 60);
    const mins = remMinutes % 60;
    const roundedHours = Math.max(1, Math.round(remMinutes / 60));

    let label = "";
    let compactLabel = "";

    if (typeof window !== "undefined" && window.i18n && window.i18n.t) {
      if (hours >= 1) {
        label = mins > 0
          ? window.i18n.t("status_opening_hours_mins", { hours, mins })
          : window.i18n.t("status_opening_hours", { hours });
        compactLabel = window.i18n.t("status_opening_hours", { hours: roundedHours });
      } else {
        label = window.i18n.t("status_opening_mins", { mins });
        compactLabel = label;
      }
    } else {
      if (lang === "en") {
        if (hours >= 1) {
          label = mins > 0 ? `Opens in ${hours}h ${mins}m` : `Opens in ${hours}h`;
          compactLabel = `Opens in ${roundedHours}h`;
        } else {
          label = `Opens in ${mins}m`;
          compactLabel = `Opens in ${mins}m`;
        }
      } else if (lang === "ko") {
        if (hours >= 1) {
          label = mins > 0 ? `오픈 ${hours}시간 ${mins}분 전` : `오픈 ${hours}시간 전`;
          compactLabel = `오픈 ${roundedHours}시간 전`;
        } else {
          label = `오픈 ${mins}분 전`;
          compactLabel = `오픈 ${mins}분 전`;
        }
      } else {
        // Default: Chinese
        if (hours >= 1) {
          label = mins > 0 ? `剩${hours}小时${mins}分开业` : `剩${hours}小时开业`;
          compactLabel = `剩${roundedHours}小时开业`;
        } else {
          label = `剩${mins}分钟开业`;
          compactLabel = `剩${mins}分钟开业`;
        }
      }
    }

    return {
      status: "未开门",
      statusKey: "status_opening",
      label,
      compactLabel,
      cls: "status-opening",
      remainingMinutes: remMinutes,
      remainingHours: hours,
      remainingMinutesPart: mins,
      is24h: false,
      openTime: openStr,
      closeTime: null
    };
  },

  /**
   * Format open status details and countdown text.
   */
  formatOpenStatus(remMinutes, is24h, closeStr, options = {}) {
    const lang = options.lang || (typeof window !== "undefined" && window.i18n ? window.i18n.currentLang : "zh");

    if (is24h) {
      const label = (typeof window !== "undefined" && window.i18n)
        ? window.i18n.t("status_24h")
        : (lang === "en" ? "Open 24 hours" : (lang === "ko" ? "24시간 영업" : "24小时营业"));
      return {
        status: "营业中",
        statusKey: "status_open",
        label,
        compactLabel: label,
        cls: "status-open",
        remainingMinutes: null,
        remainingHours: null,
        is24h: true,
        closeTime: null
      };
    }

    const hours = Math.floor(remMinutes / 60);
    const mins = remMinutes % 60;
    const roundedHours = Math.max(1, Math.round(remMinutes / 60));

    let label = "";
    let compactLabel = "";

    if (typeof window !== "undefined" && window.i18n) {
      if (hours >= 1) {
        label = mins > 0
          ? window.i18n.t("status_remaining_hours_mins", { hours, mins })
          : window.i18n.t("status_remaining_hours", { hours });
        compactLabel = window.i18n.t("status_remaining_hours", { hours: roundedHours });
      } else {
        label = window.i18n.t("status_remaining_mins", { mins });
        compactLabel = label;
      }
    } else {
      if (lang === "en") {
        if (hours >= 1) {
          label = mins > 0 ? `Closes in ${hours}h ${mins}m` : `Closes in ${hours}h`;
          compactLabel = `Closes in ${roundedHours}h`;
        } else {
          label = `Closes in ${mins}m`;
          compactLabel = `Closes in ${mins}m`;
        }
      } else if (lang === "ko") {
        if (hours >= 1) {
          label = mins > 0 ? `마감 ${hours}시간 ${mins}분 전` : `마감 ${hours}시간 전`;
          compactLabel = `마감 ${roundedHours}시간 전`;
        } else {
          label = `마감 ${mins}분 전`;
          compactLabel = `마감 ${mins}분 전`;
        }
      } else {
        // Default: Chinese
        if (hours >= 1) {
          label = mins > 0 ? `剩${hours}小时${mins}分打烊` : `剩${hours}小时打烊`;
          compactLabel = `剩${roundedHours}小时打烊`;
        } else {
          label = `剩${mins}分钟打烊`;
          compactLabel = `剩${mins}分钟打烊`;
        }
      }
    }

    return {
      status: "营业中",
      statusKey: "status_open",
      label,
      compactLabel,
      cls: "status-open",
      remainingMinutes: remMinutes,
      remainingHours: hours,
      remainingMinutesPart: mins,
      is24h: false,
      closeTime: closeStr
    };
  }
};

// Export to window if in browser environment for vanilla script access
if (typeof window !== "undefined") {
  window.BusinessHours = BusinessHours;
}
