import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./styles.css";
import { FormBanner, FieldError } from "./FormFeedback.jsx";
import {
  fallbackApiMessage,
  hasFieldErrors,
  parseApiFieldErrors,
  scrollToFeedback,
  validateClientForm,
  validateHolidayForm,
  validateLoginForm,
  validatePasswordResetForm,
  validateResetEmailForm,
} from "./formFeedback.js";

let memoryCsrfToken = localStorage.getItem("ctv_csrf_token") || "";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`,
  withCredentials: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
  withXSRFToken: true,
});

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

api.interceptors.request.use((config) => {
  const method = String(config.method || "get").toLowerCase();
  if (!["get", "head", "options", "trace"].includes(method)) {
    const csrfToken = getCookie("csrftoken") || memoryCsrfToken;
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers["X-CSRFToken"] = decodeURIComponent(csrfToken);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.csrf_token) {
      memoryCsrfToken = response.data.csrf_token;
      localStorage.setItem("ctv_csrf_token", memoryCsrfToken);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = String(originalRequest?.url || "");
    const canRefresh = status === 401 && originalRequest && !originalRequest._retry && !url.includes("/auth/token/");
    if (!canRefresh) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;
    try {
      const refreshRes = await api.post("/auth/token/refresh/");
      if (refreshRes.data && refreshRes.data.csrf_token) {
        memoryCsrfToken = refreshRes.data.csrf_token;
        localStorage.setItem("ctv_csrf_token", memoryCsrfToken);
      }
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);
const savedSession = JSON.parse(sessionStorage.getItem("ctv_session") || localStorage.getItem("ctv_session") || "null");
const savedViewRaw = localStorage.getItem("ctv_active_view") || "dashboard";
const savedView = ["entries", "employees"].includes(savedViewRaw) ? "dashboard" : savedViewRaw;
const urlParams = new URLSearchParams(window.location.search);

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{}:;,.?";

// Real Indian public & gazetted holidays by month (month index 1–12)
const INDIA_HOLIDAYS = {
  1: [
    { name: "New Year's Day", day: 1, type: "Optional" },
    { name: "Makar Sankranti / Pongal", day: 14, type: "Regional" },
    { name: "Republic Day", day: 26, type: "National" },
  ],
  2: [
    { name: "Vasant Panchami", day: 2, type: "Regional" },
    { name: "Maha Shivaratri", day: 26, type: "Gazetted" },
  ],
  3: [
    { name: "Holi", day: 14, type: "Gazetted", duration_days: 2 },
    { name: "Ugadi / Gudi Padwa", day: 30, type: "Regional" },
  ],
  4: [
    { name: "Ram Navami", day: 6, type: "Gazetted" },
    { name: "Mahavir Jayanti", day: 10, type: "Gazetted" },
    { name: "Good Friday", day: 18, type: "Gazetted" },
    { name: "Ambedkar Jayanti", day: 14, type: "Gazetted" },
  ],
  5: [
    { name: "Maharashtra Day / Labour Day", day: 1, type: "Regional" },
    { name: "Buddha Purnima", day: 12, type: "Gazetted" },
  ],
  6: [
    { name: "Id-ul-Zuha (Bakrid)", day: 7, type: "Gazetted" },
  ],
  7: [
    { name: "Muharram", day: 6, type: "Gazetted" },
  ],
  8: [
    { name: "Raksha Bandhan", day: 9, type: "Optional" },
    { name: "Independence Day", day: 15, type: "National" },
    { name: "Janmashtami", day: 16, type: "Gazetted" },
  ],
  9: [
    { name: "Ganesh Chaturthi", day: 5, type: "Gazetted", duration_days: 2 },
    { name: "Milad-un-Nabi (Prophet's Birthday)", day: 5, type: "Gazetted" },
    { name: "Onam", day: 5, type: "Regional", duration_days: 2 },
  ],
  10: [
    { name: "Gandhi Jayanti", day: 2, type: "National" },
    { name: "Navratri / Dussehra", day: 2, type: "Gazetted", duration_days: 10 },
    { name: "Dussehra (Vijaya Dashami)", day: 12, type: "Gazetted" },
    { name: "Diwali (Lakshmi Puja)", day: 20, type: "Gazetted", duration_days: 2 },
    { name: "Diwali (Bali Pratipada)", day: 21, type: "Gazetted" },
  ],
  11: [
    { name: "Guru Nanak Jayanti", day: 5, type: "Gazetted" },
  ],
  12: [
    { name: "Christmas Day", day: 25, type: "Gazetted" },
  ],
};

function pad2(n) { return String(n).padStart(2, "0"); }

function formatDateValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateValue(date);
}

function formatHolidayDuration(days) {
  const duration = Math.max(1, Number(days) || 1);
  return duration === 1 ? "1 day" : `${duration} days`;
}

function formatHolidayRange(holiday) {
  const duration = Math.max(1, Number(holiday.duration_days) || 1);
  if (!holiday.date || duration === 1) return holiday.date;
  return `${holiday.date} to ${addDays(holiday.date, duration - 1)}`;
}

function formatDate(dateValue) {
  if (!dateValue) return '[No date]';
  try {
    const date = new Date(`${dateValue}T00:00:00`);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateValue;
  }
}

function getHolidayDatesForMonth(holiday, year, month) {
  if (!holiday.date) return [];
  const duration = Math.max(1, Number(holiday.duration_days) || 1);
  return Array.from({ length: duration }, (_, index) => addDays(holiday.date, index)).filter((dateValue) => {
    const date = new Date(`${dateValue}T00:00:00`);
    return date.getFullYear() === Number(year) && date.getMonth() + 1 === Number(month);
  });
}

function getWeekdayKey(date) {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
}

function getHolidayLabelForDate(holidaysForMonth, dateValue) {
  return holidaysForMonth
    .filter((holiday) => getHolidayDatesForMonth(holiday, new Date(`${dateValue}T00:00:00`).getFullYear(), new Date(`${dateValue}T00:00:00`).getMonth() + 1).includes(dateValue))
    .map((holiday) => holiday.name)
    .join(", ");
}

function calculateMonthWorkingDays(year, month, config, holidaysForMonth) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const holidayDates = new Set(holidaysForMonth.flatMap((holiday) => getHolidayDatesForMonth(holiday, year, month)));
  let total = 0;
  const days = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    const dateValue = formatDateValue(date);
    const isConfiguredWorkday = Boolean(config[getWeekdayKey(date)]);
    const holidayName = getHolidayLabelForDate(holidaysForMonth, dateValue);
    const isHoliday = holidayDates.has(dateValue);
    const isWorkingDay = isConfiguredWorkday && !isHoliday;
    if (isWorkingDay) total += 1;
    days.push({ day, date: dateValue, weekday: date.toLocaleDateString("en-IN", { weekday: "short" }), holidayName, isConfiguredWorkday, isHoliday, isWorkingDay });
  }

  return { total, days };
}


function toTitleCase(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function shuffleText(value) {
  return value
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

function generateTemporaryPassword() {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = PASSWORD_SYMBOLS;
  const pool = uppercase + lowercase + numbers + symbols;
  const characters = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  while (characters.length < 14) {
    characters.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return shuffleText(characters.join(""));
}

async function copyToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function getFieldMessage(error, field) {
  const value = error.response?.data?.[field];
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "string") return value;
  return "";
}

function withKnownVersion(payload, updatedAt) {
  return updatedAt ? { ...payload, last_known_updated_at: updatedAt } : payload;
}

function friendlyApiError(error, fallback) {
  if (!error.response) {
    return "Network error — check your internet connection and try again.";
  }
  const status = error.response?.status;
  const data = error.response?.data;
  if (status === 401) {
    return "Your session has expired. Please log in again.";
  }
  if (status === 403) {
    if (typeof data?.detail === "string") {
      return data.detail;
    }
    return "You do not have permission to make that change.";
  }
  if (status === 404) {
    return "The requested item was not found. It may have been deleted.";
  }
  if (status === 409) {
    return "This record was updated by someone else while you were editing. Please refresh and review the latest version before saving again.";
  }
  if (status >= 500) {
    return "Server error — please try again later or contact an administrator.";
  }
  if (Array.isArray(data)) {
    return data.join(" ");
  }
  if (typeof data?.detail === "string") {
    if (data.detail.toLowerCase().includes("current password is incorrect")) {
      return "The current or temporary password you entered is incorrect.";
    }
    return data.detail;
  }
  if (data?.non_field_errors?.some((item) => String(item).toLowerCase().includes("unique"))) {
    const message = data.non_field_errors.join(" ").toLowerCase();
    if (message.includes("client") || message.includes("month")) {
      return "This client already has calendar rules saved for that month and year. Use Save again after confirming that you want to replace them.";
    }
    return "A record with the same details already exists. Please edit the existing record instead.";
  }
  if (data?.date?.length) return `Date: ${data.date.join(" ")}`;
  if (data?.name?.length) return `Name: ${data.name.join(" ")}`;
  if (data?.client?.length) return `Client: ${data.client.join(" ")}`;
  if (data && typeof data === "object") {
    const fieldMessages = Object.entries(data)
      .filter(([field]) => field !== "non_field_errors")
      .map(([field, message]) => {
        const combined = Array.isArray(message) ? message.join(" ") : String(message);
        if (combined.toLowerCase().includes("may not be blank")) {
          return `${toTitleCase(field)} is required.`;
        }
        return `${toTitleCase(field)}: ${combined}`;
      });
    if (fieldMessages.length) return fieldMessages.join(" ");
  }
  return fallback;
}

function normalizeLookup(value) {
  return String(value || "").trim().toLowerCase();
}

function defaultMonthConfig(client, year, month) {
  return {
    client,
    year,
    month,
    working_days: 0,
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
    weekend_policy: "unpaid",
  };
}

function isDefaultFiveDayWeek(config) {
  return Boolean(config.mon && config.tue && config.wed && config.thu && config.fri && !config.sat && !config.sun);
}

function getIndiaHolidaysForMonth(year, month) {
  return (INDIA_HOLIDAYS[month] || []).map((h) => ({
    ...h,
    date: `${year}-${pad2(month)}-${pad2(h.day)}`,
    duration_days: h.duration_days || 1,
    weekday: new Date(year, month - 1, h.day).toLocaleDateString("en-IN", { weekday: "long" }),
  })).filter((holiday) => Number(holiday.date.slice(5, 7)) === Number(month));
}

function buildHolidayDayRows(holidays, year, month, source = "saved") {
  return holidays
    .flatMap((holiday) =>
      getHolidayDatesForMonth(holiday, year, month).map((dateValue) => ({
        key: `${source}-${holiday.id || holiday.name}-${dateValue}`,
        name: holiday.name,
        date: dateValue,
        weekday: new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" }),
        type: holiday.type || "public",
        source,
      }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

const initialClient = { name: "", status: "active" };
const initialUser = {
  email: "",
  first_name: "",
  last_name: "",
  role: "user",
  password: "",
  can_edit_calendar_setup: false,
};

function headers(token) {
  return {};
}

function buildPasswordMetaFromAuthPayload(data) {
  if (!data) {
    return { expiresInDays: 0, mustReset: false, expiresAt: null };
  }
  return {
    expiresInDays: data.password_expires_in_days ?? 0,
    mustReset: Boolean(data.must_reset_password),
    expiresAt: data.password_expires_at ?? null,
  };
}

function PasswordExpiryCountdown({ expiresAt, expiresInDays }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (expiresAt) {
    const endMs = new Date(expiresAt).getTime();
    if (Number.isNaN(endMs)) {
      return <p className="muted">Password expiry time is unavailable.</p>;
    }
    const ms = endMs - nowMs;
    const expired = ms <= 0;
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const mi = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return (
      <div className={`password-countdown${expired ? " expired" : ""}`}>
        <strong>Time until password expires</strong>
        <p className="password-countdown-digits" aria-live="polite">
          {`${d}d ${h}h ${mi}m ${s}s`}
        </p>
        {expired ? (
          <p className="password-countdown-note">
            Your rotation window has ended. You can still change your password below while this session is active. After you sign out, you must set a new password before using the app again (you will be prompted right after sign-in; use your current password there). Use Forgot password? only if you no longer know your password.
          </p>
        ) : (
          <p className="muted password-countdown-hint">
            Based on your last password change plus 90 days (server time).
          </p>
        )}
      </div>
    );
  }
  return (
    <p className="muted">
      Calendar-day estimate from last sign-in: <strong>{expiresInDays}</strong> full day(s) before the policy treats the password as expired. Stay on this page to load the precise countdown from the server.
    </p>
  );
}

function CloverLogo() {
  return (
    <div className="brand-lockup" aria-label="Clover Infotech Working Days System">
      <div className="brand-mark"><span /><span /><span /><span /></div>
      <div>
        <strong>Clover Infotech</strong>
        <small>Working Days System</small>
      </div>
    </div>
  );
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={open
          ? "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7Z"
          : "M3 4.5 20 21m-5.2-5.05A9.7 9.7 0 0 1 12 18c-6.5 0-10-6-10-6a18.8 18.8 0 0 1 4.24-4.72M9.9 6.33A10.5 10.5 0 0 1 12 6c6.5 0 10 6 10 6a18.9 18.9 0 0 1-3.63 4.3M10.6 10.72A2.5 2.5 0 0 0 13.28 13.4"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function PasswordField({ value, onChange, readOnly = false, disabled = false, autoComplete = "current-password", name = "", id = "" }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-field ${readOnly ? "readonly" : ""}`}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        disabled={disabled}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}

function App() {
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(savedSession?.user ? "cookie" : "");
  const [user, setUser] = useState(savedSession?.user || null);
  const [passwordMeta, setPasswordMeta] = useState(savedSession?.passwordMeta || null);
  const [activeView, setActiveView] = useState(savedView);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userManagementError, setUserManagementError] = useState("");
  const [userFormErrors, setUserFormErrors] = useState({ email: "", password: "" });
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [forcedResetError, setForcedResetError] = useState("");
  const [busy, setBusy] = useState(false);

  const [clients, setClients] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [workingDayConfigs, setWorkingDayConfigs] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  const [clientForm, setClientForm] = useState(initialClient);
  const [userForm, setUserForm] = useState(initialUser);
  const [resetPassword, setResetPassword] = useState({ userId: "", email: "", newPassword: "", currentPasswordPreview: "" });
  const [deleteAccount, setDeleteAccount] = useState({ userId: "", email: "", role: "", password: "", selfDelete: false });
  const [changePassword, setChangePassword] = useState({ current_password: "", new_password: "" });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [toast, setToast] = useState("");
  const resetPanelRef = useRef(null);

  const [calendarForm, setCalendarForm] = useState({
    client: "",
    year: 2026,
    month: 5,
    working_days: 22,
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
    weekend_policy: "unpaid",
    updated_at: "",
  });
  const [holidayForm, setHolidayForm] = useState({ client: "", name: "", date: "", duration_days: 1, type: "company" });
  const [holidayFormErrors, setHolidayFormErrors] = useState({});
  const [holidayFormBanner, setHolidayFormBanner] = useState("");
  const [clientFormErrors, setClientFormErrors] = useState({});
  const [clientFormBanner, setClientFormBanner] = useState("");
  const [calendarFormBanner, setCalendarFormBanner] = useState("");
  const [loginFormErrors, setLoginFormErrors] = useState({});
  const [loginFormBanner, setLoginFormBanner] = useState("");
  const [editingHoliday, setEditingHoliday] = useState(null);
  const activeViewRef = useRef(activeView);
  const calendarFormRef = useRef(calendarForm);
  const holidayFormRef = useRef(holidayForm);

  const [showResetRequest, setShowResetRequest] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLinkData] = useState({
    isResetLink: urlParams.get("reset") === "1",
    uid: urlParams.get("uid") || "",
    token: urlParams.get("token") || "",
  });
  const [newResetPassword, setNewResetPassword] = useState("");
  const [oneTimePasswordReveal, setOneTimePasswordReveal] = useState(null);
  const [revealTempPassword, setRevealTempPassword] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [savedHolidaySearch, setSavedHolidaySearch] = useState("");
  const [savedHolidayMonthFilter, setSavedHolidayMonthFilter] = useState("current");
  const [savedHolidaysClientFilter, setSavedHolidaysClientFilter] = useState("");
  const [editingHolidayErrors, setEditingHolidayErrors] = useState({});
  const [calendarExcelFile, setCalendarExcelFile] = useState(null);
  const [calendarExcelPreview, setCalendarExcelPreview] = useState(null);
  const [calendarExcelExtraction, setCalendarExcelExtraction] = useState(null);
  const [calendarExcelError, setCalendarExcelError] = useState("");
  const [calendarExcelBusy, setCalendarExcelBusy] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState("");

  const isAdmin = user?.role === "admin";
  const filteredUsers = useMemo(() => {
    const q = String(userSearch || "").trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const email = String(u.email || "").toLowerCase();
      const first = String(u.first_name || "").toLowerCase();
      const last = String(u.last_name || "").toLowerCase();
      return email.includes(q) || first.includes(q) || last.includes(q);
    });
  }, [users, userSearch]);
  const pendingUsers = useMemo(() => {
    return users.filter((u) => u.must_reset_password && u.is_active);
  }, [users]);
  const canEditCalendarSetup = isAdmin || Boolean(user?.can_edit_calendar_setup);
  const selectedClient = clients.find((client) => String(client.id) === String(calendarForm.client));
  const savedHolidaysClient = clients.find((client) => String(client.id) === String(savedHolidaysClientFilter || calendarForm.client));
  const selectedClientHolidays = holidays.filter((holiday) => String(holiday.client) === String(calendarForm.client));
  const savedPanelClientHolidays = holidays.filter((holiday) => String(holiday.client) === String(savedHolidaysClientFilter || calendarForm.client));
  const selectedMonthHolidays = selectedClientHolidays.filter((holiday) => getHolidayDatesForMonth(holiday, calendarForm.year, calendarForm.month).length > 0);
  const existingHolidayNameMatch = savedPanelClientHolidays.find((holiday) => normalizeLookup(holiday.name) === normalizeLookup(holidayForm.name));
  const savedHolidaysForPanel = savedPanelClientHolidays
    .filter((holiday) => {
      if (savedHolidayMonthFilter === "all") return true;
      const filterMonth = savedHolidayMonthFilter === "current" ? Number(calendarForm.month) : Number(savedHolidayMonthFilter);
      return getHolidayDatesForMonth(holiday, calendarForm.year, filterMonth).length > 0;
    })
    .filter((holiday) => {
      const query = savedHolidaySearch.trim().toLowerCase();
      if (!query) return true;
      return [holiday.name, holiday.date, holiday.type, monthNames[calendarForm.month - 1]].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const groupedSavedHolidays = savedHolidaysForPanel.reduce((groups, holiday) => {
    const date = holiday.date ? new Date(`${holiday.date}T00:00:00`) : null;
    const monthLabel = date ? `${monthNames[date.getMonth()]} ${date.getFullYear()}` : "Undated";
    if (!groups[monthLabel]) groups[monthLabel] = [];
    groups[monthLabel].push(holiday);
    return groups;
  }, {});
  const addedRecommendationDates = new Set(selectedClientHolidays.flatMap((holiday) => getHolidayDatesForMonth(holiday, calendarForm.year, calendarForm.month)));
  const selectedIndiaHolidays = getIndiaHolidaysForMonth(calendarForm.year, calendarForm.month).filter((holiday) => !addedRecommendationDates.has(holiday.date));
  const currentMonthBreakdown = calculateMonthWorkingDays(calendarForm.year, calendarForm.month, calendarForm, selectedMonthHolidays);
  const monthCalendarInsight = useMemo(() => {
    const year = Number(calendarForm.year);
    const month = Number(calendarForm.month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const weekdayOnlyBreakdown = calculateMonthWorkingDays(year, month, calendarForm, []);
    const savedHolidayRows = buildHolidayDayRows(selectedMonthHolidays, year, month, "saved");
    const savedDateSet = new Set(savedHolidayRows.map((row) => row.date));
    const indiaReferenceRows = buildHolidayDayRows(
      getIndiaHolidaysForMonth(year, month).filter((holiday) => !savedDateSet.has(holiday.date)),
      year,
      month,
      "india-reference"
    );
    const holidayExclusions = Math.max(0, weekdayOnlyBreakdown.total - currentMonthBreakdown.total);
    return {
      daysInMonth,
      weekdaySlots: weekdayOnlyBreakdown.total,
      holidayExclusions,
      suggestedWorkingDays: currentMonthBreakdown.total,
      savedHolidayRows,
      indiaReferenceRows,
    };
  }, [calendarForm, selectedMonthHolidays, currentMonthBreakdown]);
  const displayedWorkingDays = Number(calendarForm.working_days) || monthCalendarInsight.suggestedWorkingDays;
  const countedSavedHolidays = selectedMonthHolidays.map((holiday) => ({
    ...holiday,
    monthDates: getHolidayDatesForMonth(holiday, calendarForm.year, calendarForm.month),
  }));
  const yearSummary = monthNames.map((name, index) => {
    const month = index + 1;
    const savedConfig = workingDayConfigs.find((config) => String(config.client) === String(calendarForm.client) && Number(config.year) === Number(calendarForm.year) && Number(config.month) === month);
    const isSelectedMonth = month === Number(calendarForm.month);
    const config = isSelectedMonth ? calendarForm : (savedConfig || defaultMonthConfig(calendarForm.client, calendarForm.year, month));
    const monthHolidays = selectedClientHolidays.filter((holiday) => getHolidayDatesForMonth(holiday, calendarForm.year, month).length > 0);
    const breakdown = calculateMonthWorkingDays(calendarForm.year, month, config, monthHolidays);
    return {
      month,
      name,
      saved: Boolean(savedConfig),
      isSelectedMonth,
      configured: config.working_days || breakdown.total,
      calculated: breakdown.total,
      holidays: monthHolidays.length,
    };
  });

  const navItems = useMemo(() => {
    const items = [
      { id: "dashboard", label: "Dashboard" },
      { id: "clients", label: "Clients" },
      { id: "calendarView", label: "Calendar" },
    ];
    if (canEditCalendarSetup) items.splice(2, 0, { id: "calendar", label: "Calendar Setup" });
    if (isAdmin) items.push({ id: "users", label: "User Management" });
    if (isAdmin) items.push({ id: "audit", label: "Audit Logs" });
    items.push({ id: "security", label: "Security" });
    return items;
  }, [canEditCalendarSetup, isAdmin]);

  useEffect(() => {
    if (!message) return undefined;
    const dismissMs = 4500;
    const timerId = window.setTimeout(() => setMessage(""), dismissMs);
    return () => window.clearTimeout(timerId);
  }, [message]);

  useEffect(() => {
    if (!toast) return undefined;
    const timerId = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timerId);
  }, [toast]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    calendarFormRef.current = calendarForm;
  }, [calendarForm]);

  useEffect(() => {
    holidayFormRef.current = holidayForm;
  }, [holidayForm]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (token && user) {
      sessionStorage.setItem("ctv_session", JSON.stringify({ user, passwordMeta }));
      localStorage.removeItem("ctv_session");
    } else {
      sessionStorage.removeItem("ctv_session");
      localStorage.removeItem("ctv_session");
    }
  }, [token, user, passwordMeta]);

  useEffect(() => {
    localStorage.setItem("ctv_active_view", activeView);
  }, [activeView]);

  useEffect(() => {
    if (!resetPassword.userId || !resetPanelRef.current) return;
    resetPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [resetPassword.userId]);

  useEffect(() => {
    if (!token) return;
    loadWorkspace();
  }, [token]);

  useEffect(() => {
    if (token && user?.role === "admin") {
      loadUsers();
      loadAuditLogs();
    }
  }, [token, user]);

  useEffect(() => {
    if (!token) return undefined;

    let warningTimeoutId = null;
    let logoutTimeoutId = null;
    let visibilityTimeoutId = null;

    const INACTIVITY_LOGOUT_MS = 10 * 60 * 1000; // 10 minutes
    const INACTIVITY_WARNING_MS = 9 * 60 * 1000; // 9 minutes
    const VISIBILITY_LOGOUT_MS = 5 * 60 * 1000; // 5 minutes

    function resetInactivityTimers() {
      if (warningTimeoutId) clearTimeout(warningTimeoutId);
      if (logoutTimeoutId) clearTimeout(logoutTimeoutId);

      warningTimeoutId = setTimeout(() => {
        setToast("You will be logged out in 1 minute due to inactivity.");
      }, INACTIVITY_WARNING_MS);

      logoutTimeoutId = setTimeout(() => {
        saveCalendarDraft();
        logout();
      }, INACTIVITY_LOGOUT_MS);
    }

    resetInactivityTimers();

    const activityEvents = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    function handleUserActivity() {
      resetInactivityTimers();
    }

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    function handleVisibilityChange() {
      if (document.hidden) {
        visibilityTimeoutId = setTimeout(() => {
          saveCalendarDraft();
          logout();
        }, VISIBILITY_LOGOUT_MS);
      } else {
        if (visibilityTimeoutId) {
          clearTimeout(visibilityTimeoutId);
          visibilityTimeoutId = null;
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (warningTimeoutId) clearTimeout(warningTimeoutId);
      if (logoutTimeoutId) clearTimeout(logoutTimeoutId);
      if (visibilityTimeoutId) clearTimeout(visibilityTimeoutId);

      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token]);

  useEffect(() => {
    if (!token || activeView !== "security") return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/auth/me/", { headers: headers(token) });
        if (cancelled) return;
        setPasswordMeta(buildPasswordMetaFromAuthPayload(data));
      } catch {
        /* keep existing session meta */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeView, token]);

  useEffect(() => {
    setRevealTempPassword(false);
  }, [oneTimePasswordReveal]);

  useEffect(() => {
    if (!token || !isAdmin || activeView !== "users") return undefined;
    const pendingUsers = users.filter((u) => u.must_reset_password && u.is_active);
    if (pendingUsers.length === 0) return undefined;

    const intervalId = setInterval(() => {
      loadUsers();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [users, token, isAdmin, activeView]);

  useEffect(() => {
    if (!calendarForm.client && clients[0]) {
      setCalendarForm((current) => ({ ...current, client: clients[0].id }));
      setHolidayForm((current) => ({ ...current, client: clients[0].id }));
    }
  }, [clients, calendarForm.client]);

  useEffect(() => {
    if (activeView === "users" && !isAdmin) {
      setActiveView("dashboard");
    }
    if (activeView === "audit" && !isAdmin) {
      setActiveView("dashboard");
    }
    if (activeView === "calendar" && !canEditCalendarSetup) {
      setActiveView("calendarView");
    }
    if (activeView === "entries" || activeView === "employees") {
      setActiveView("dashboard");
    }
  }, [activeView, canEditCalendarSetup, isAdmin]);


  useEffect(() => {
    function handleScroll() {
      setShowBackToTop(window.scrollY > 320);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const client = calendarForm.client;
    const year = calendarForm.year;
    const month = calendarForm.month;
    if (!client) return;

    const savedConfig = workingDayConfigs.find(
      (config) =>
        String(config.client) === String(client) &&
        Number(config.year) === Number(year) &&
        Number(config.month) === Number(month)
    );

    if (savedConfig) {
      setCalendarForm((current) => ({
        ...current,
        working_days: savedConfig.working_days,
        mon: savedConfig.mon,
        tue: savedConfig.tue,
        wed: savedConfig.wed,
        thu: savedConfig.thu,
        fri: savedConfig.fri,
        sat: savedConfig.sat,
        sun: savedConfig.sun,
        weekend_policy: savedConfig.weekend_policy,
        updated_at: savedConfig.updated_at || "",
      }));
      return;
    }

    const defaults = defaultMonthConfig(client, year, month);
    setCalendarForm((current) => ({
      ...current,
      mon: defaults.mon,
      tue: defaults.tue,
      wed: defaults.wed,
      thu: defaults.thu,
      fri: defaults.fri,
      sat: defaults.sat,
      sun: defaults.sun,
      weekend_policy: defaults.weekend_policy,
      working_days: 0,
      updated_at: "",
    }));
  }, [workingDayConfigs, calendarForm.client, calendarForm.year, calendarForm.month]);

  useEffect(() => {
    if (calendarForm.client) {
      setSavedHolidaysClientFilter(calendarForm.client);
    }
  }, [calendarForm.client]);

  function clearErrors() {
    setError("");
    setUserManagementError("");
    setUserFormErrors({ email: "", password: "" });
    setResetPasswordError("");
    setDeleteAccountError("");
    setSecurityError("");
    setForcedResetError("");
    setHolidayFormErrors({});
    setHolidayFormBanner("");
    setClientFormErrors({});
    setClientFormBanner("");
    setCalendarFormBanner("");
    setLoginFormErrors({});
    setLoginFormBanner("");
    setEditingHolidayErrors({});
  }

  function clearEditingHolidayField(field) {
    setEditingHolidayErrors((current) => ({ ...current, [field]: "" }));
  }

  function startHolidayEdit(holiday) {
    setEditingHoliday({ ...holiday, duration_days: holiday.duration_days || 1 });
    setEditingHolidayErrors({});
    setHolidayFormBanner("");
  }

  function cancelHolidayEdit() {
    setEditingHoliday(null);
    setEditingHolidayErrors({});
  }

  function resetCalendarExcelUpload() {
    setCalendarExcelFile(null);
    setCalendarExcelPreview(null);
    setCalendarExcelExtraction(null);
    setCalendarExcelError("");
    setSelectedSheet("");
  }

  function matchedClientId(clientName) {
    const target = normalizeLookup(clientName);
    if (!target) return "";
    const exact = clients.find((client) => normalizeLookup(client.name) === target);
    if (exact) return exact.id;
    const partial = clients.find((client) => normalizeLookup(client.name).includes(target) || target.includes(normalizeLookup(client.name)));
    return partial?.id || "";
  }

  function calendarFormWithExtraction() {
    const fields = calendarExcelExtraction?.fields || {};
    const clientId = matchedClientId(fields.client_name);
    return {
      ...calendarForm,
      ...(clientId ? { client: clientId } : {}),
      ...(fields.year ? { year: Number(fields.year) } : {}),
      ...(fields.month ? { month: Number(fields.month) } : {}),
      ...(fields.working_days ? { working_days: Number(fields.working_days) } : {}),
      ...(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].reduce((updates, day) => {
        if (typeof fields[day] === "boolean") updates[day] = fields[day];
        return updates;
      }, {})),
      ...(fields.weekend_policy ? { weekend_policy: fields.weekend_policy } : {}),
    };
  }

  async function previewCalendarExcel(file) {
    if (!file) {
      resetCalendarExcelUpload();
      return;
    }
    setCalendarExcelFile(file);
    setCalendarExcelPreview(null);
    setCalendarExcelExtraction(null);
    setCalendarExcelError("");
    setCalendarExcelBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/calendar-excel/preview/", formData, { headers: headers(token) });
      setCalendarExcelPreview(data);
    } catch (requestError) {
      setCalendarExcelError(friendlyApiError(requestError, "Unable to preview this Excel file."));
    } finally {
      setCalendarExcelBusy(false);
    }
  }

  async function extractCalendarExcel() {
    if (!calendarExcelFile) {
      setCalendarExcelError("Choose an Excel file first.");
      return;
    }
    setCalendarExcelBusy(true);
    setCalendarExcelError("");
    setCalendarExcelExtraction(null);
    try {
      const formData = new FormData();
      formData.append("file", calendarExcelFile);
      if (selectedSheet) formData.append("sheet_name", selectedSheet);
      const { data } = await api.post("/calendar-excel/extract/", formData, { headers: headers(token) });
      setCalendarExcelExtraction(data);
    } catch (requestError) {
      const data = requestError.response?.data;
      setCalendarExcelExtraction(data?.fields ? data : null);
      setCalendarExcelError(data?.message || friendlyApiError(requestError, "No relevant calendar fields found in this Excel file."));
    } finally {
      setCalendarExcelBusy(false);
    }
  }

  async function registerExcelClient() {
    const clientMatch = calendarExcelExtraction?.client_match;
    if (!clientMatch || clientMatch.matched || !clientMatch.excel_client_name) return;
    setCalendarExcelBusy(true);
    setCalendarExcelError("");
    try {
      const { data: newClient } = await api.post("/clients/", { name: clientMatch.excel_client_name, status: "active" }, { headers: headers(token) });
      await loadWorkspace();
      setCalendarExcelExtraction((current) => ({
        ...current,
        client_match: {
          ...current.client_match,
          matched: true,
          matched_client_name: newClient.name,
          matched_client_id: newClient.id,
          is_exact: true,
        },
      }));
      notifySuccess(`Client "${newClient.name}" registered successfully. You can now save the extraction.`);
    } catch (requestError) {
      setCalendarExcelError(friendlyApiError(requestError, `Unable to register client "${clientMatch.excel_client_name}".`));
    } finally {
      setCalendarExcelBusy(false);
    }
  }

  function saveCalendarExcelExtraction() {
    if (!calendarExcelExtraction?.fields) return;
    const clientMatch = calendarExcelExtraction.client_match;
    if (clientMatch && clientMatch.excel_client_name && !clientMatch.matched) {
      setCalendarExcelError("Register the client first before saving.");
      return;
    }
    const nextForm = calendarFormWithExtraction();
    const clientLabel = clients.find((client) => String(client.id) === String(nextForm.client))?.name || calendarExcelExtraction.fields.client_name || "selected client";
    const extractedHolidays = (calendarExcelExtraction.holidays || []).filter((h) => h.name && h.date);
    const holidaySummary = extractedHolidays.length > 0 ? ` and ${extractedHolidays.length} holiday(s)` : "";
    setConfirmDialog({
      title: "Save extracted calendar data?",
      message: `This will save ${nextForm.working_days || displayedWorkingDays} working days${holidaySummary} for ${clientLabel}, ${monthNames[Number(nextForm.month) - 1] || "selected month"} ${nextForm.year}.`,
      confirmLabel: "Save",
      onConfirm: async () => {
        clearErrors();
        const payload = { ...nextForm, working_days: Number(nextForm.working_days) || displayedWorkingDays };
        try {
          const response = await api.post("/working-day-configs/", withKnownVersion(payload, nextForm.updated_at), { headers: headers(token) });
          setCalendarForm((current) => ({ ...current, ...nextForm, working_days: response.data.working_days, updated_at: response.data.updated_at || "" }));
          setWorkingDayConfigs((current) => [
            ...current.filter(
              (config) =>
                !(
                  String(config.client) === String(response.data.client) &&
                  Number(config.year) === Number(response.data.year) &&
                  Number(config.month) === Number(response.data.month)
                )
            ),
            response.data,
          ]);

          // Save extracted holidays
          const clientId = nextForm.client;
          let holidaysSaved = 0;
          let holidaysSkipped = 0;
          for (const holiday of extractedHolidays) {
            try {
              await api.post("/holidays/", {
                client: clientId,
                name: holiday.name,
                date: holiday.date,
                type: holiday.type || "public",
                duration_days: holiday.duration_days || 1,
              }, { headers: headers(token) });
              holidaysSaved += 1;
            } catch {
              holidaysSkipped += 1;
            }
          }

          if (clientId) {
            setHolidayForm((current) => ({ ...current, client: clientId }));
          }
          const parts = ["Calendar rules saved."];
          if (holidaysSaved > 0) parts.push(`${holidaysSaved} holiday(s) added.`);
          if (holidaysSkipped > 0) parts.push(`${holidaysSkipped} holiday(s) skipped (duplicates or invalid).`);
          notifySuccess(parts.join(" "));
          resetCalendarExcelUpload();
          loadWorkspace();
        } catch (requestError) {
          setCalendarFormBanner(fallbackApiMessage(requestError, "Unable to save extracted calendar rules."));
          scrollToFeedback("calendar-form-feedback");
        }
      },
    });
  }

  function applyFormApiError(requestError, { anchorId, setFieldErrors, setBanner, fallback }) {
    const { fields, form } = parseApiFieldErrors(requestError);
    setFieldErrors(fields);
    const banner =
      form ||
      (Object.keys(fields).length > 0 ? "Please fix the highlighted fields below." : fallbackApiMessage(requestError, fallback));
    setBanner(banner);
    setError("");
    scrollToFeedback(anchorId);
  }

  function clearHolidayFieldError(field) {
    setHolidayFormErrors((current) => ({ ...current, [field]: "" }));
    setHolidayFormBanner("");
  }

  function clearFeedback() {
    clearErrors();
    setMessage("");
  }

  function notifySuccess(successMessage) {
    setToast(successMessage);
    setError("");
  }

  function navigateToView(view, opts = {}) {
    const preserveFeedback = Boolean(opts.preserveFeedback);
    if (!preserveFeedback) {
      setMessage("");
      setError("");
    }
    setActiveView(view);
    if (view === "users") {
      loadUsers();
    }
    if (view === "audit") {
      loadAuditLogs();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copyPassword(text, successMessage = "Password copied.") {
    const copied = await copyToClipboard(text);
    if (copied) {
      notifySuccess(successMessage);
    } else {
      setError("Copy failed. Please copy the password manually.");
    }
  }

  function fillGeneratedUserPassword() {
    const generated = generateTemporaryPassword();
    setUserForm((current) => ({ ...current, password: generated }));
    setUserFormErrors((current) => ({ ...current, password: "" }));
    setMessage("A policy-safe temporary password has been generated.");
  }

  function fillGeneratedResetPassword() {
    const generated = generateTemporaryPassword();
    setResetPassword((current) => ({ ...current, newPassword: generated }));
    setResetPasswordError("");
    setMessage("A policy-safe temporary password has been generated.");
  }

  async function loadWorkspace() {
    clearErrors();
    try {
      const [clientRes, holidayRes, configRes] = await Promise.all([
        api.get("/clients/", { headers: headers(token) }),
        api.get("/holidays/", { headers: headers(token) }),
        api.get("/working-day-configs/", { headers: headers(token) }),
      ]);
      setClients(clientRes.data);
      setHolidays(holidayRes.data);
      setWorkingDayConfigs(configRes.data);
    } catch (err) {
      if (!err.response) {
        setError(
          "Unable to load workspace data. The browser could not reach the API—start the Django server (for example on 127.0.0.1:8000).",
        );
      } else if (err.response.status >= 500) {
        setError(
          "Unable to load workspace data. The API returned a server error—check the Django terminal log; if you just updated the project, run: python manage.py migrate",
        );
      } else {
        setError("Unable to load workspace data. Try refreshing the page or signing in again.");
      }
    }
  }

  async function login(event) {
    event.preventDefault();
    clearErrors();
    const validation = validateLoginForm(email, password);
    if (hasFieldErrors(validation)) {
      setLoginFormErrors(validation);
      setLoginFormBanner("Please fix the highlighted fields.");
      scrollToFeedback("login-form-feedback");
      return;
    }
    setBusy(true);
    try {
      const response = await api.post("/auth/token/", { email, password });
      setToken("cookie");
      setUser(response.data.user);
      setPasswordMeta(buildPasswordMetaFromAuthPayload(response.data));
      setPassword("");
      setChangePassword({ current_password: "", new_password: "" });
      const canEdit = response.data.user.role === "admin" || Boolean(response.data.user.can_edit_calendar_setup);
      const savedDraft = localStorage.getItem("ctv_calendar_draft");
      if (canEdit && savedDraft) {
        try {
          const { calendarForm: draftCalendar, holidayForm: draftHoliday } = JSON.parse(savedDraft);
          if (draftCalendar) setCalendarForm(draftCalendar);
          if (draftHoliday) setHolidayForm(draftHoliday);
          navigateToView("calendar");
          setToast("Your calendar setup progress has been restored.");
          localStorage.removeItem("ctv_calendar_draft");
        } catch (e) {
          console.error("Error restoring calendar draft:", e);
          navigateToView("dashboard", { preserveFeedback: true });
          notifySuccess("Signed in successfully.");
        }
      } else {
        navigateToView("dashboard", { preserveFeedback: true });
        notifySuccess("Signed in successfully.");
      }
    } catch (requestError) {
      applyFormApiError(requestError, {
        anchorId: "login-form-feedback",
        setFieldErrors: setLoginFormErrors,
        setBanner: setLoginFormBanner,
        fallback: "Unable to sign in.",
      });
    } finally {
      setBusy(false);
    }
  }

  function saveCalendarDraft() {
    if (activeViewRef.current === "calendar") {
      localStorage.setItem(
        "ctv_calendar_draft",
        JSON.stringify({
          calendarForm: calendarFormRef.current,
          holidayForm: holidayFormRef.current,
        })
      );
    }
  }

  async function logout() {
    try {
      await api.post("/auth/logout/");
    } catch {
      /* Clear the local session even if the API is unreachable. */
    }
    setToken("");
    setUser(null);
    setEmail("");
    setPassword("");
    setChangePassword({ current_password: "", new_password: "" });
    setMessage("");
    setError("");
    setToast("");
    navigateToView("dashboard");
    sessionStorage.removeItem("ctv_session");
    localStorage.removeItem("ctv_session");
    localStorage.removeItem("ctv_active_view");
    memoryCsrfToken = "";
    localStorage.removeItem("ctv_csrf_token");
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    clearFeedback();
    const validation = validateResetEmailForm(resetEmail);
    if (hasFieldErrors(validation)) {
      setLoginFormErrors(validation);
      setLoginFormBanner("Enter the email address for your approved account.");
      scrollToFeedback("login-form-feedback");
      return;
    }
    setBusy(true);
    try {
      const response = await api.post("/auth/request-password-reset/", { email: resetEmail });
      setMessage(response.data.detail || "If this account exists, a reset link has been sent.");
      setLoginFormBanner("");
      setLoginFormErrors({});
    } catch (requestError) {
      applyFormApiError(requestError, {
        anchorId: "login-form-feedback",
        setFieldErrors: setLoginFormErrors,
        setBanner: setLoginFormBanner,
        fallback: "Unable to request password reset.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmPasswordReset(event) {
    event.preventDefault();
    clearFeedback();
    const validation = validatePasswordResetForm(newResetPassword);
    if (hasFieldErrors(validation)) {
      setLoginFormErrors(validation);
      setLoginFormBanner("Enter a new password that meets the policy.");
      scrollToFeedback("login-form-feedback");
      return;
    }
    setBusy(true);
    try {
      const response = await api.post("/auth/confirm-password-reset/", {
        uid: resetLinkData.uid,
        token: resetLinkData.token,
        new_password: newResetPassword,
      });
      setMessage(response.data.detail || "Password reset successfully.");
      setNewResetPassword("");
      setLoginFormErrors({});
      setLoginFormBanner("");
      window.history.replaceState({}, "", "/");
    } catch (requestError) {
      applyFormApiError(requestError, {
        anchorId: "login-form-feedback",
        setFieldErrors: setLoginFormErrors,
        setBanner: setLoginFormBanner,
        fallback: "Unable to reset password.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveClient(event) {
    event.preventDefault();
    clearErrors();
    const validation = validateClientForm(clientForm);
    if (hasFieldErrors(validation)) {
      setClientFormErrors(validation);
      setClientFormBanner("Please fix the highlighted fields.");
      scrollToFeedback("client-form-feedback");
      return;
    }
    try {
      await api.post("/clients/", clientForm, { headers: headers(token) });
      setClientForm(initialClient);
      setClientFormErrors({});
      setClientFormBanner("");
      notifySuccess("Client added successfully.");
      loadWorkspace();
    } catch (requestError) {
      applyFormApiError(requestError, {
        anchorId: "client-form-feedback",
        setFieldErrors: setClientFormErrors,
        setBanner: setClientFormBanner,
        fallback: "Unable to save client.",
      });
    }
  }

  async function updateClient(client, updates) {
    clearErrors();
    try {
      await api.patch(`/clients/${client.id}/`, withKnownVersion(updates, client.updated_at), { headers: headers(token) });
      notifySuccess("Client updated successfully.");
      loadWorkspace();
    } catch (requestError) {
      setError(friendlyApiError(requestError, "Unable to update client."));
    }
  }

  function requestClientStatusChange(client) {
    const nextStatus = client.status === "active" ? "inactive" : "active";
    setConfirmDialog({
      title: `${nextStatus === "inactive" ? "Deactivate" : "Activate"} client?`,
      message:
        nextStatus === "inactive"
          ? `${client.name} will stay in the system, but it will not be available for new setup and assignment work until it is activated again.`
          : `${client.name} will become available again for calendar setup and holidays.`,
      confirmLabel: `${nextStatus === "inactive" ? "Deactivate" : "Activate"} client`,
      onConfirm: async () => {
        clearErrors();
        try {
          await api.patch(`/clients/${client.id}/`, withKnownVersion({ status: nextStatus }, client.updated_at), { headers: headers(token) });
          notifySuccess(nextStatus === "inactive" ? "Client deactivated successfully." : "Client activated successfully.");
          loadWorkspace();
        } catch (requestError) {
          setError(friendlyApiError(requestError, "Unable to update client."));
        }
      },
    });
  }

  async function deleteClient(client) {
    setConfirmDialog({
      title: "Delete client?",
      message: `Deleting ${client.name} will also remove its holiday and calendar records.`,
      confirmLabel: "Delete client",
      onConfirm: async () => {
        clearErrors();
        try {
          await api.delete(`/clients/${client.id}/`, { headers: headers(token) });
          notifySuccess("Client deleted successfully.");
          loadWorkspace();
        } catch (requestError) {
          setError(friendlyApiError(requestError, "Unable to delete client."));
        }
      },
    });
  }

  async function persistCalendarSave() {
    clearErrors();
    const daysInMonth = monthCalendarInsight.daysInMonth;
    if (displayedWorkingDays > daysInMonth) {
      setCalendarFormBanner(`Error: Calculated working days (${displayedWorkingDays}) cannot exceed calendar days in month (${daysInMonth}).`);
      scrollToFeedback("calendar-form-feedback");
      return;
    }
    try {
      const response = await api.post("/working-day-configs/", withKnownVersion({ ...calendarForm, working_days: displayedWorkingDays }, calendarForm.updated_at), { headers: headers(token) });
      setCalendarForm((current) => ({ ...current, working_days: displayedWorkingDays, updated_at: response.data.updated_at || "" }));
      setWorkingDayConfigs((current) => [
        ...current.filter(
          (config) =>
            !(
              String(config.client) === String(response.data.client) &&
              Number(config.year) === Number(response.data.year) &&
              Number(config.month) === Number(response.data.month)
            )
        ),
        response.data,
      ]);
      setCalendarFormBanner("");
      notifySuccess("Working day setup saved for this client and month.");
      loadWorkspace();
    } catch (requestError) {
      setCalendarFormBanner(fallbackApiMessage(requestError, "Unable to save working day setup."));
      scrollToFeedback("calendar-form-feedback");
    }
  }

  async function saveCalendar(event) {
    event.preventDefault();
    const existingConfig = workingDayConfigs.find(
      (config) =>
        String(config.client) === String(calendarForm.client) &&
        Number(config.year) === Number(calendarForm.year) &&
        Number(config.month) === Number(calendarForm.month)
    );
    if (existingConfig) {
      setConfirmDialog({
        title: "Replace saved calendar rules?",
        message: "This month already has saved rules. Saving now will replace the old weekday and weekend settings for this client.",
        confirmLabel: "Replace rules",
        onConfirm: persistCalendarSave,
      });
      return;
    }
    await persistCalendarSave();
  }

  async function saveHoliday(event) {
    event.preventDefault();
    clearFeedback();
    const payload = { ...holidayForm, client: holidayForm.client || savedHolidaysClientFilter || calendarForm.client };
    const validation = validateHolidayForm(payload);
    if (hasFieldErrors(validation)) {
      setHolidayFormErrors(validation);
      setHolidayFormBanner("Please fix the highlighted fields before saving.");
      scrollToFeedback("holiday-form-feedback");
      return;
    }
    const existingHoliday = selectedClientHolidays.find(
      (holiday) =>
        normalizeLookup(holiday.name) === normalizeLookup(holidayForm.name)
    );
    if (existingHoliday) {
      setConfirmDialog({
        title: "Update existing holiday?",
        message: `${existingHoliday.name} already exists for this client. Saving now will replace its date, duration, and type with the values currently in the form.`,
        confirmLabel: "Update holiday",
        onConfirm: async () => {
          clearErrors();
          try {
            await api.patch(`/holidays/${existingHoliday.id}/`, withKnownVersion(payload, existingHoliday.updated_at), { headers: headers(token) });
            setHolidayForm({ ...payload, name: "", date: "", duration_days: 1 });
            setHolidayFormErrors({});
            setHolidayFormBanner("");
            notifySuccess("Holiday updated for this client.");
            loadWorkspace();
          } catch (requestError) {
            applyFormApiError(requestError, {
              anchorId: "holiday-form-feedback",
              setFieldErrors: setHolidayFormErrors,
              setBanner: setHolidayFormBanner,
              fallback: "Unable to save holiday.",
            });
          }
        },
      });
      return;
    }
    try {
      await api.post("/holidays/", payload, { headers: headers(token) });
      setHolidayForm({ ...payload, name: "", date: "", duration_days: 1 });
      setHolidayFormErrors({});
      setHolidayFormBanner("");
      notifySuccess("Client holiday added successfully.");
      loadWorkspace();
    } catch (requestError) {
      applyFormApiError(requestError, {
        anchorId: "holiday-form-feedback",
        setFieldErrors: setHolidayFormErrors,
        setBanner: setHolidayFormBanner,
        fallback: "Unable to save holiday.",
      });
    }
  }

  async function addRecommendedHoliday(holiday) {
    clearErrors();
    if (!calendarForm.client) {
      setHolidayFormBanner("Select a client before adding holidays.");
      scrollToFeedback("holiday-form-feedback");
      return;
    }
    try {
      await api.post(
        "/holidays/",
        { client: calendarForm.client, name: holiday.name, date: holiday.date, duration_days: holiday.duration_days, type: "public" },
        { headers: headers(token) }
      );
      notifySuccess("Holiday added to company holidays.");
      loadWorkspace();
    } catch (requestError) {
      applyFormApiError(requestError, {
        anchorId: "holiday-form-feedback",
        setFieldErrors: setHolidayFormErrors,
        setBanner: setHolidayFormBanner,
        fallback: "Unable to add holiday.",
      });
    }
  }

  async function persistHolidayUpdate(anchorId = "holiday-edit-feedback") {
    if (!editingHoliday?.id) return false;
    const payload = {
      client: editingHoliday.client,
      name: editingHoliday.name,
      date: editingHoliday.date,
      duration_days: editingHoliday.duration_days,
      type: editingHoliday.type,
    };
    const validation = validateHolidayForm(payload);
    if (hasFieldErrors(validation)) {
      setEditingHolidayErrors(validation);
      setHolidayFormBanner("Please fix the highlighted fields before saving.");
      scrollToFeedback(anchorId);
      return false;
    }
    clearErrors();
    try {
      await api.patch(`/holidays/${editingHoliday.id}/`, withKnownVersion(payload, editingHoliday.updated_at), { headers: headers(token) });
      setEditingHoliday(null);
      setEditingHolidayErrors({});
      setHolidayFormBanner("");
      notifySuccess("Holiday updated successfully.");
      loadWorkspace();
      return true;
    } catch (requestError) {
      applyFormApiError(requestError, {
        anchorId,
        setFieldErrors: setEditingHolidayErrors,
        setBanner: setHolidayFormBanner,
        fallback: "Unable to update holiday.",
      });
      return false;
    }
  }

  async function updateHoliday(event) {
    event.preventDefault();
    await persistHolidayUpdate(`saved-holiday-edit-${editingHoliday?.id || "holiday-edit-feedback"}`);
  }

  async function deleteHoliday(holiday) {
    setConfirmDialog({
      title: "Remove holiday?",
      message: `${holiday.name} will be removed from this client's saved holidays and from the working-day calculations that depend on it.`,
      confirmLabel: "Remove holiday",
      onConfirm: async () => {
        clearErrors();
        try {
          await api.delete(`/holidays/${holiday.id}/`, { headers: headers(token) });
          if (editingHoliday?.id === holiday.id) setEditingHoliday(null);
          notifySuccess("Holiday removed successfully.");
          loadWorkspace();
        } catch (requestError) {
          setError(friendlyApiError(requestError, "Unable to remove holiday."));
        }
      },
    });
  }

  async function createUser(event) {
    event.preventDefault();
    clearErrors();

    // Client-side validation
    const localErrors = {};
    if (!String(userForm.email || "").trim()) {
      localErrors.email = "Email is required.";
    }

    if (localErrors.email) {
      setUserFormErrors({
        email: localErrors.email || "",
        password: "",
      });
      scrollToFeedback("user-email-field");
      return;
    }

    // Auto-generate temporary password on the client side just before sending to backend
    const generatedPassword = generateTemporaryPassword();
    const payload = {
      ...userForm,
      password: generatedPassword,
    };

    try {
      const response = await api.post("/users/", payload, { headers: headers(token) });
      setUserForm(initialUser);
      if (response.data?.email_sent) {
        notifySuccess(`Account created. Temporary password has been emailed to ${response.data.email}.`);
      } else {
        // Fallback: If email failed to send, return the password to be copied manually
        if (response.data?.one_time_temporary_password) {
          setOneTimePasswordReveal({
            email: response.data.email,
            password: response.data.one_time_temporary_password,
          });
          notifySuccess("Account created, but email could not be sent. Copy the temporary password below manually.");
        } else {
          notifySuccess("Account created successfully. The user must change their password on first sign-in.");
        }
      }
      loadUsers();
      loadAuditLogs();
    } catch (requestError) {
      const { fields, form } = parseApiFieldErrors(requestError);
      const emailError = fields.email || getFieldMessage(requestError, "email");
      if (emailError) {
        setUserFormErrors({ email: emailError, password: "" });
        setUserManagementError(form || "");
        scrollToFeedback("user-email-field");
      } else {
        setUserFormErrors({ email: "", password: "" });
        setUserManagementError(form || friendlyApiError(requestError, "Unable to create user."));
        scrollToFeedback("user-form-feedback");
      }
    }
  }

  async function loadUsers() {
    setUsersLoaded(false);
    try {
      const response = await api.get("/users/", { headers: headers(token) });
      setUsers(response.data);
    } catch {
      setUserManagementError("Unable to load users.");
    } finally {
      setUsersLoaded(true);
    }
  }

  async function loadAuditLogs() {
    try {
      const response = await api.get("/audit-logs/", { headers: headers(token) });
      setAuditLogs(response.data);
    } catch {
      setUserManagementError("Unable to load audit logs right now.");
    }
  }

  async function updateUserAccount(account, patch, successMessage) {
    clearErrors();
    try {
      const response = await api.patch(`/users/${account.id}/`, withKnownVersion(patch, account.updated_at), { headers: headers(token) });
      setUsers((current) => current.map((item) => (String(item.id) === String(account.id) ? response.data : item)));
      if (String(user?.id) === String(account.id)) {
        setUser(response.data);
      }
      notifySuccess(successMessage);
      loadAuditLogs();
    } catch (requestError) {
      setUserManagementError(friendlyApiError(requestError, "Unable to update this account."));
    }
  }

  async function resetUserPassword(userId) {
    clearErrors();
    try {
      const response = await api.post(
        `/users/${userId}/reset-password/`,
        { new_password: resetPassword.newPassword, must_reset_password: true, clear_edit_permissions: true },
        { headers: headers(token) }
      );
      if (response.data?.email_sent) {
        notifySuccess(`Password reset applied. Temporary password has been emailed to ${response.data.email}.`);
      } else {
        // Fallback: If email failed to send, return the password to be copied manually
        if (response.data?.one_time_temporary_password) {
          setOneTimePasswordReveal({
            email: response.data.email,
            password: response.data.one_time_temporary_password,
          });
          notifySuccess("Password reset applied, but email could not be sent. Copy the temporary password below manually.");
        } else {
          notifySuccess("Password reset successfully.");
        }
      }
      setResetPassword({ userId: "", email: "", newPassword: "", currentPasswordPreview: "" });
      loadUsers();
      loadAuditLogs();
    } catch (requestError) {
      setResetPasswordError(getFieldMessage(requestError, "new_password") || friendlyApiError(requestError, "Unable to reset password."));
    }
  }

  async function resendPendingPasswordEmail(account) {
    clearErrors();
    const newPassword = generateTemporaryPassword();
    try {
      const response = await api.post(
        `/users/${account.id}/reset-password/`,
        { new_password: newPassword, must_reset_password: true, clear_edit_permissions: false },
        { headers: headers(token) }
      );
      if (response.data?.email_sent) {
        notifySuccess(`A new temporary password has been generated and emailed to ${account.email}.`);
      } else {
        if (response.data?.one_time_temporary_password) {
          setOneTimePasswordReveal({
            email: response.data.email,
            password: response.data.one_time_temporary_password,
          });
          notifySuccess("Temporary password regenerated, but email could not be sent. Copy it below manually.");
        } else {
          notifySuccess("Temporary password regenerated successfully.");
        }
      }
      loadUsers();
      loadAuditLogs();
    } catch (requestError) {
      setError(friendlyApiError(requestError, "Unable to resend temporary password email."));
    }
  }

  function openResetPasswordPanel(account) {
    setResetPasswordError("");
    setResetPassword({
      userId: account.id,
      email: account.email,
      newPassword: generateTemporaryPassword(),
      currentPasswordPreview: "",
    });
  }

  function requestUserReset(account) {
    setConfirmDialog({
      title: "Prepare account reset?",
      message:
        account.role === "admin"
          ? `${account.email} will be given a new temporary password. They must sign in and change it before they can use the site again.`
          : `${account.email} will be given a new temporary password. They must sign in and change it before they can use the site again.`,
      confirmLabel: "Continue to reset",
      onConfirm: async () => {
        openResetPasswordPanel(account);
      },
    });
  }

  async function deactivateUser(account) {
    setConfirmDialog({
      title: "Deactivate account?",
      message: `${account.email} will no longer be able to sign in until this account is activated again.`,
      confirmLabel: "Deactivate account",
      onConfirm: async () => {
        clearErrors();
        try {
          await api.delete(`/users/${account.id}/`, { headers: headers(token) });
          notifySuccess(`${account.email} has been deactivated.`);
          loadUsers();
          loadAuditLogs();
        } catch (requestError) {
          setError(friendlyApiError(requestError, "Unable to deactivate user."));
        }
      },
    });
  }

  async function activateUser(account) {
    setConfirmDialog({
      title: "Activate account?",
      message: `${account.email} will be able to sign in again.`,
      confirmLabel: "Activate account",
      onConfirm: async () => {
        clearErrors();
        try {
          await api.post(`/users/${account.id}/activate/`, {}, { headers: headers(token) });
          notifySuccess(`${account.email} has been activated.`);
          loadUsers();
          loadAuditLogs();
        } catch (requestError) {
          setError(friendlyApiError(requestError, "Unable to activate user."));
        }
      },
    });
  }

  function requestDeleteAccount(account) {
    setConfirmDialog({
      title: "Prepare permanent delete?",
      message:
        account.role === "admin"
          ? "This will open the permanent delete panel. Password confirmation will still be required before the admin account can actually be deleted."
          : "This will open the permanent delete panel. Once confirmed there, the account will be permanently removed.",
      confirmLabel: "Continue",
      onConfirm: async () => {
        setDeleteAccount({ userId: account.id, email: account.email, role: account.role, password: "", selfDelete: String(account.id) === String(user.id) });
      },
    });
  }

  async function deleteUserAccount(userId) {
    clearErrors();
    try {
      const response = await api.post(
        `/users/${userId}/delete-user/`,
        { password: deleteAccount.password },
        { headers: headers(token) }
      );
      const deletingSelf = Boolean(response.data?.self_delete);
      const deletedEmail = deleteAccount.email;
      setDeleteAccount({ userId: "", email: "", role: "", password: "", selfDelete: false });
      if (deletingSelf) {
        logout();
        return;
      }
      notifySuccess(`${deletedEmail} has been permanently deleted.`);
      loadUsers();
      loadAuditLogs();
    } catch (requestError) {
      setDeleteAccountError(friendlyApiError(requestError, "Unable to delete this account."));
    }
  }

  async function submitChangePassword(event) {
    event.preventDefault();
    clearErrors();
    try {
      const response = await api.post("/auth/change-password/", changePassword, { headers: headers(token) });
      setChangePassword({ current_password: "", new_password: "" });
      setPasswordMeta(buildPasswordMetaFromAuthPayload(response.data));
      notifySuccess(passwordMeta?.mustReset ? "Your password has been updated. You can continue now." : "Password changed successfully. The 90-day expiry window has restarted.");
      navigateToView("dashboard", { preserveFeedback: true });
    } catch (requestError) {
      const passwordMessage =
        getFieldMessage(requestError, "new_password") ||
        getFieldMessage(requestError, "current_password") ||
        friendlyApiError(requestError, "Unable to change password.");
      if (passwordMeta?.mustReset) {
        setForcedResetError(passwordMessage);
      } else {
        setSecurityError(passwordMessage);
      }
    }
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-shell">
          <div className="login-showcase">
            <CloverLogo />
            <div className="login-copy">
              <p className="eyebrow inverse">Client operations calendar</p>
              <h1>Working Days System</h1>
              <p>Configure client calendars, monthly working days, and public holiday recommendations from one controlled workspace.</p>
            </div>
            <div className="login-product-shot">
              <div className="mini-window">
                <div className="mini-toolbar"><span /><span /><span /></div>
                <div className="mini-grid">
                  <strong>Area</strong><strong>Status</strong><strong>Access</strong>
                  <span>Calendar setup</span><span>Protected</span><span>Approved users</span>
                  <span>Workspace data</span><span>Private</span><span>After sign-in</span>
                </div>
              </div>
            </div>
          </div>
          <form className="login-card" autoComplete="on" onSubmit={resetLinkData.isResetLink ? confirmPasswordReset : showResetRequest ? requestPasswordReset : login}>
            <div id="login-form-feedback">
              <p className="eyebrow">Approved access</p>
              <h2>{resetLinkData.isResetLink ? "Set new password" : showResetRequest ? "Reset password" : "Sign in"}</h2>
              <FormBanner message={loginFormBanner} />
            </div>
            {resetLinkData.isResetLink ? (
              <label className={`form-field${loginFormErrors.password ? " has-error" : ""}`}>
                New password
                <PasswordField name="new-password" id="reset-new-password" value={newResetPassword} onChange={(event) => { setNewResetPassword(event.target.value); setLoginFormErrors({}); setLoginFormBanner(""); }} autoComplete="new-password" />
                <FieldError message={loginFormErrors.password} />
              </label>
            ) : showResetRequest ? (
              <label className={`form-field${loginFormErrors.email ? " has-error" : ""}`}>
                Approved email
                <input type="email" name="email" autoComplete="email" value={resetEmail} onChange={(event) => { setResetEmail(event.target.value); setLoginFormErrors({}); setLoginFormBanner(""); }} />
                <FieldError message={loginFormErrors.email} />
              </label>
            ) : (
              <div className="login-fields">
                <label className={`form-field${loginFormErrors.email ? " has-error" : ""}`}>
                  Email
                  <input type="email" name="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setLoginFormErrors({}); setLoginFormBanner(""); }} />
                  <FieldError message={loginFormErrors.email} />
                </label>
                <label className={`form-field${loginFormErrors.password ? " has-error" : ""}`}>
                  Password
                  <PasswordField name="password" id="login-password" value={password} onChange={(event) => { setPassword(event.target.value); setLoginFormErrors({}); setLoginFormBanner(""); }} autoComplete="off" />
                  <FieldError message={loginFormErrors.password} />
                </label>
              </div>
            )}
            {error && <p className="form-banner-error">{error}</p>}
            {message && !user && <p className="notice">{message}</p>}
            <button type="submit" disabled={busy}>{busy ? "Please wait..." : resetLinkData.isResetLink ? "Set password" : showResetRequest ? "Send reset link" : "Sign in"}</button>
            {!resetLinkData.isResetLink && (
              <button type="button" className="link-button" onClick={() => { setShowResetRequest(!showResetRequest); clearFeedback(); }}>
                {showResetRequest ? "Back to sign in" : "Forgot password?"}
              </button>
            )}
            <p className="login-footnote">Only admin-approved accounts can access this workspace.</p>
          </form>
        </section>
      </main>
    );
  }

  if (passwordMeta?.mustReset) {
    return (
      <main className="forced-reset-page">
        <section className="forced-reset-card">
          <div className="forced-reset-header">
            <CloverLogo />
            <button type="button" className="ghost-button" onClick={logout}>Logout</button>
          </div>
          <div className="forced-reset-copy">
            <p className="eyebrow">Password update required</p>
            <h1>Set a new password to continue</h1>
            <p>
              You signed in using a temporary or expired password. Before you can access the workspace, you must set a new password that follows the policy below.
            </p>
          </div>
            <form className="auth-form forced-reset-form" autoComplete="on" onSubmit={submitChangePassword}>
              <input type="email" name="username" autoComplete="username" value={user?.email || ""} readOnly hidden />
              <label>
                Current temporary password
                <PasswordField
                  name="current-password"
                  id="forced-current-password"
                  value={changePassword.current_password}
                  onChange={(event) => { setChangePassword({ ...changePassword, current_password: event.target.value }); setForcedResetError(""); }}
                  autoComplete="current-password"
                />
              </label>
              <label>
                New password
                <PasswordField
                  name="new-password"
                  id="forced-new-password"
                  value={changePassword.new_password}
                  onChange={(event) => { setChangePassword({ ...changePassword, new_password: event.target.value }); setForcedResetError(""); }}
                  autoComplete="new-password"
                />
              </label>
            <div className="password-policy-card">
              <strong>Password policy</strong>
              <ul>
                <li>At least 10 characters</li>
                <li>At least 1 uppercase letter</li>
                <li>At least 1 lowercase letter</li>
                <li>At least 1 number</li>
                <li>At least 1 symbol</li>
              </ul>
            </div>
            {forcedResetError && <p className="field-error">{forcedResetError}</p>}
            <button type="submit" disabled={busy}>{busy ? "Updating..." : "Save new password"}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-frame">
      <aside className="sidebar">
        <CloverLogo />
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={activeView === item.id ? "nav-item active" : "nav-item"} type="button" onClick={() => navigateToView(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">{isAdmin ? "Admin panel" : "User workspace"}</p>
            <h1>{activeView === "dashboard" ? "Calendar Configuration Desk" : navItems.find((item) => item.id === activeView)?.label}</h1>
          </div>
          <div className="user-chip"><span>{user.email}</span><strong>{user.role}</strong><button type="button" onClick={logout}>Logout</button></div>
        </header>

        {(message || error) && (
          <section className="status-strip" role="status" aria-live="polite">
            {message && (
              <p className="notice">
                {message}
                <button type="button" className="status-dismiss" aria-label="Dismiss message" onClick={() => setMessage("")}>×</button>
              </p>
            )}
            {error && (
              <p className="error">
                {error}
                <button type="button" className="status-dismiss" aria-label="Dismiss error" onClick={() => setError("")}>×</button>
              </p>
            )}
          </section>
        )}

        {oneTimePasswordReveal && (
          <section className="one-time-password-banner" role="alert">
            <div className="one-time-password-banner-inner">
              <strong>One-time temporary password for {oneTimePasswordReveal.email}</strong>
              <p className="muted">This value is shown once only. It is hashed in the database and cannot be viewed again in Inspect or API responses.</p>
              <div className="password-field readonly" style={{ position: "relative" }}>
                <code className="one-time-password-value" style={{ paddingRight: "46px" }}>
                  {revealTempPassword ? oneTimePasswordReveal.password : "•".repeat(oneTimePasswordReveal.password.length)}
                </code>
                <button
                  type="button"
                  className="password-toggle"
                  style={{ top: 0, bottom: 0, height: "100%" }}
                  aria-label={revealTempPassword ? "Hide password" : "Show password"}
                  aria-pressed={revealTempPassword}
                  onClick={() => setRevealTempPassword((curr) => !curr)}
                >
                  <EyeIcon open={revealTempPassword} />
                </button>
              </div>
              <div className="inline-actions">
                <button type="button" className="ghost-button" onClick={() => copyPassword(oneTimePasswordReveal.password, "Temporary password copied.")}>Copy password</button>
                <button type="button" onClick={() => setOneTimePasswordReveal(null)}>Dismiss</button>
              </div>
            </div>
          </section>
        )}

        {activeView === "dashboard" && (
          <section className="dashboard-stack">
            <div className="hero-panel">
              <div>
                <p className="eyebrow inverse">Configuration workspace</p>
                <h2>Set monthly client calendars for each company.</h2>
                <p>Use public holiday suggestions and client-specific holidays to configure working days for each month.</p>
              </div>
              <button type="button" onClick={() => navigateToView("calendar")}>Configure calendar</button>
            </div>
            <section className="content-grid">
              <MetricCard label="Clients" value={clients.length} detail="Active clients available for setup" />
              <MetricCard label="Saved holidays" value={holidays.length} detail="Client-specific holidays on record" />
              <MetricCard label="Calendar configs" value={workingDayConfigs.length} detail="Saved monthly working-day rules" />
            </section>
            <section className="workflow-grid">
              <WorkflowCard step="01" title="Choose client/month" text="Select a client and month/year for setup." />
              <WorkflowCard step="02" title="Review holidays" text="Use recommended public holidays, then add client-specific holidays." />
              <WorkflowCard step="03" title="Save rules" text="Save working-day rules so the calendar is ready for downstream use." />
            </section>
          </section>
        )}

        {activeView === "clients" && (
          <section className="two-column">
            <form className="panel" onSubmit={saveClient}>
              <div id="client-form-feedback" className="panel-header"><h2>Add Client</h2></div>
              <FormBanner message={clientFormBanner} />
              <label className={`form-field${clientFormErrors.name ? " has-error" : ""}`}>
                Client name
                <input value={clientForm.name} onChange={(event) => { setClientForm({ ...clientForm, name: event.target.value }); setClientFormErrors({}); setClientFormBanner(""); }} />
                <FieldError message={clientFormErrors.name} />
              </label>
              <label>Status<select value={clientForm.status} onChange={(event) => setClientForm({ ...clientForm, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
              <button type="submit">Save client</button>
            </form>
            <section className="panel">
              <div className="panel-header"><h2>Client List</h2><button type="button" onClick={loadWorkspace}>Refresh</button></div>
              <div className="card-list">
                {clients.map((client) => (
                  <article className="info-card" key={client.id}>
                    <span>{client.status}</span>
                    <strong>{client.name}</strong>
                    
                    <div className="card-actions">
                      <button type="button" className="small-button" onClick={() => requestClientStatusChange(client)}>
                        {client.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                      <button type="button" className="small-button danger-button" onClick={() => deleteClient(client)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeView === "calendar" && (
          <section className="calendar-setup-page">
            <section className="panel calendar-saved-holidays-wide calendar-saved-holidays-top">
              <div className="panel-header saved-holidays-header">
                <div>
                  <p className="eyebrow">Client holidays</p>
                  <h2>Saved holidays — {savedHolidaysClient?.name || "client"}</h2>
                </div>
                <span className="pill pending">{savedHolidaysForPanel.length} shown</span>
              </div>
              <div className="saved-holidays-toolbar">
                <label className="saved-holiday-client-filter">
                  Client
                  <ClientSelect
                    clients={clients}
                    value={savedHolidaysClientFilter || calendarForm.client}
                    onChange={(value) => {
                      setSavedHolidaysClientFilter(value);
                      setHolidayForm((current) => ({ ...current, client: value }));
                      cancelHolidayEdit();
                    }}
                  />
                </label>
                <label className="saved-holiday-search">
                  Search
                  <input
                    type="search"
                    placeholder="Name, date, or type…"
                    value={savedHolidaySearch}
                    onChange={(event) => setSavedHolidaySearch(event.target.value)}
                  />
                </label>
                <label className="saved-holiday-month-filter">
                  Month
                  <select value={savedHolidayMonthFilter} onChange={(event) => setSavedHolidayMonthFilter(event.target.value)}>
                    <option value="current">Current month ({monthNames[calendarForm.month - 1]} {calendarForm.year})</option>
                    <option value="all">All months</option>
                    {monthNames.map((month, index) => (
                      <option key={month} value={index + 1}>{month} {calendarForm.year}</option>
                    ))}
                  </select>
                </label>
              </div>
              <FormBanner message={holidayFormBanner} />
              <div className="saved-holidays-scroll">
                {Object.entries(groupedSavedHolidays).length > 0 ? (
                  Object.entries(groupedSavedHolidays).map(([monthLabel, monthHolidays]) => (
                    <section key={monthLabel} className="holiday-month-group">
                      <div className="holiday-month-header">{monthLabel}</div>
                      <div className="holiday-existing-cards saved-holiday-cards">
                        {monthHolidays.map((holiday) => (
                          <div
                            key={holiday.id}
                            id={editingHoliday?.id === holiday.id ? `saved-holiday-edit-${holiday.id}` : undefined}
                            className={editingHoliday?.id === holiday.id ? "holiday-existing-card editing" : existingHolidayNameMatch?.id === holiday.id ? "holiday-existing-card active" : "holiday-existing-card"}
                          >
                            {editingHoliday?.id === holiday.id ? (
                              <div className="saved-holiday-inline-form">
                                <label className={`form-field${editingHolidayErrors.name ? " has-error" : ""}`}>
                                  Name
                                  <input value={editingHoliday.name} onChange={(event) => { setEditingHoliday({ ...editingHoliday, name: event.target.value }); clearEditingHolidayField("name"); }} />
                                  <FieldError message={editingHolidayErrors.name} />
                                </label>
                                <label className={`form-field${editingHolidayErrors.date ? " has-error" : ""}`}>
                                  Date
                                  <input type="date" value={editingHoliday.date} onChange={(event) => { setEditingHoliday({ ...editingHoliday, date: event.target.value }); clearEditingHolidayField("date"); }} />
                                  <FieldError message={editingHolidayErrors.date} />
                                </label>
                                <label className={`form-field${editingHolidayErrors.duration_days ? " has-error" : ""}`}>
                                  Duration
                                  <input type="number" min="1" value={editingHoliday.duration_days} onChange={(event) => { setEditingHoliday({ ...editingHoliday, duration_days: Math.max(1, Number(event.target.value) || 1) }); clearEditingHolidayField("duration_days"); }} />
                                  <FieldError message={editingHolidayErrors.duration_days} />
                                </label>
                                <label className={`form-field${editingHolidayErrors.type ? " has-error" : ""}`}>
                                  Type
                                  <select value={editingHoliday.type} onChange={(event) => { setEditingHoliday({ ...editingHoliday, type: event.target.value }); clearEditingHolidayField("type"); }}>
                                    <option value="public">Public</option>
                                    <option value="company">Company</option>
                                  </select>
                                  <FieldError message={editingHolidayErrors.type} />
                                </label>
                                <div className="saved-holiday-inline-actions">
                                  <button type="button" className="small-button" onClick={() => persistHolidayUpdate(`saved-holiday-edit-${holiday.id}`)}>Save</button>
                                  <button type="button" className="small-button ghost-button" onClick={cancelHolidayEdit}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="holiday-existing-view">
                                  <div className="holiday-existing-title-row">
                                    <strong>{holiday.name}</strong>
                                    <small>{formatHolidayDuration(holiday.duration_days)} - {toTitleCase(holiday.type)}</small>
                                  </div>
                                  <span>{formatHolidayRange(holiday)}</span>
                                </div>
                                <div className="saved-holiday-card-actions">
                                  <button type="button" className="small-button ghost-button" onClick={() => startHolidayEdit(holiday)}>Edit</button>
                                  <button type="button" className="small-button danger-button holiday-delete-button" onClick={() => deleteHoliday(holiday)}>Delete</button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <p className="muted no-holidays-msg">
                    {savedHolidaySearch.trim()
                      ? "No saved holidays match your search."
                      : savedHolidayMonthFilter === "all"
                        ? "No saved holidays for this client yet. Add one using the form below."
                        : "No saved holidays for the selected month filter. Choose All months or add a holiday below."}
                  </p>
                )}
              </div>
            </section>

            <div className="calendar-setup-top">
            {/* Excel Import Section - TOP LEVEL */}
            <section className="panel calendar-import-panel" aria-label="Calendar setup from Excel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">CALENDAR SETUP</p>
                  <h2>Fill from Excel spreadsheet</h2>
                </div>
                {calendarExcelFile && <span className="pill pending">{calendarExcelFile.name}</span>}
              </div>
              <div className="calendar-excel-actions">
                <label className="calendar-excel-picker">
                  Upload Excel
                  <input
                    type="file"
                    accept=".xlsx,.xlsm,.xltx,.xltm"
                    onChange={(event) => previewCalendarExcel(event.target.files?.[0])}
                  />
                </label>
                <button type="button" className="ghost-button" disabled={!calendarExcelFile || calendarExcelBusy} onClick={extractCalendarExcel}>
                  {calendarExcelBusy ? "Reading..." : "Extract details"}
                </button>
                {(calendarExcelFile || calendarExcelPreview || calendarExcelExtraction) && (
                  <button type="button" className="ghost-button" onClick={resetCalendarExcelUpload}>Clear</button>
                )}
              </div>
              {calendarExcelError && <p className="field-error">{calendarExcelError}</p>}
              {calendarExcelPreview?.sheets?.length > 0 && !calendarExcelExtraction?.valid && (() => {
                const activeSheetName = selectedSheet || calendarExcelPreview.sheets[0].name;
                const activeSheet = calendarExcelPreview.sheets.find(s => s.name === activeSheetName) || calendarExcelPreview.sheets[0];
                return (
                <div className="calendar-excel-preview">
                  <div className="calendar-excel-preview-top">
                    <strong>Preview before extraction</strong>
                    {calendarExcelPreview.sheets.length > 1 ? (
                      <select
                        className="sheet-selector"
                        value={activeSheetName}
                        onChange={(e) => setSelectedSheet(e.target.value)}
                      >
                        {calendarExcelPreview.sheets.map(s => (
                          <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{activeSheet.name}</span>
                    )}
                  </div>
                  <div className="table-wrap compact-table">
                    <table>
                      <tbody>
                        {activeSheet.rows.map((row, rowIndex) => (
                          <tr key={`preview-${rowIndex}`}>
                            {row.slice(0, 8).map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell || "-"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                );
              })()}
              {calendarExcelExtraction?.valid && (
                <div className="calendar-excel-result">
                  <div className="extraction-header">
                    <strong>✅ {calendarExcelExtraction.matched_fields.length} field(s) extracted successfully</strong>
                    <p className="muted">Review extracted data below. Fields with ⚠️ require manual verification.</p>
                  </div>

                  {/* Client Match Detection */}
                  {calendarExcelExtraction.client_match && calendarExcelExtraction.client_match.excel_client_name && (
                    calendarExcelExtraction.client_match.matched ? (
                      <div className="client-match-banner client-match-success">
                        <span className="client-match-icon">✅</span>
                        <div className="client-match-text">
                          <strong>Client matched</strong>
                          <p>
                            "{calendarExcelExtraction.client_match.excel_client_name}" from the Excel
                            {calendarExcelExtraction.client_match.is_exact
                              ? " matches "
                              : " partially matches "}
                            registered client <strong>"{calendarExcelExtraction.client_match.matched_client_name}"</strong>.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="client-match-banner client-match-warning">
                        <span className="client-match-icon">⚠️</span>
                        <div className="client-match-text">
                          <strong>Client not registered</strong>
                          <p>
                            "{calendarExcelExtraction.client_match.excel_client_name}" from the Excel does not match any registered client.
                            You can register it now, or cancel and use an existing client.
                          </p>
                          <div className="client-match-actions">
                            <button type="button" className="small-button" disabled={calendarExcelBusy} onClick={registerExcelClient}>
                              {calendarExcelBusy ? "Registering…" : `Register "${calendarExcelExtraction.client_match.excel_client_name}" & apply`}
                            </button>
                            <button type="button" className="small-button ghost-button" onClick={resetCalendarExcelUpload}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                  {calendarExcelExtraction.client_match && !calendarExcelExtraction.client_match.excel_client_name && (
                    <div className="client-match-banner client-match-warning">
                      <span className="client-match-icon">ℹ️</span>
                      <div className="client-match-text">
                        <strong>No client name found in the Excel</strong>
                        <p>The extraction did not find a client name. You will need to select the client manually from the calendar setup form.</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Extracted Fields with Validation */}
                  <div className="extracted-fields-section">
                    <h4>Calendar Details</h4>
                    <div className="extracted-fields-grid">
                      {Object.entries(calendarExcelExtraction.fields).map(([field, value]) => {
                        const fieldNames = { client: 'Client', year: 'Year', month: 'Month', working_days: 'Working Days' };
                        const isPartiallyFilled = (value === null || value === '' || value === 0);
                        const status = isPartiallyFilled ? { valid: false, icon: '⚠️', msg: 'Requires editing' } : { valid: true, icon: '✅', msg: 'Ready' };
                        return (
                          <article key={field} className={`extracted-field ${status.valid ? 'ready' : 'needs-review'}`}>
                            <div className="field-header">
                              <span className="field-name">{fieldNames[field] || toTitleCase(field)}</span>
                              <span className={`field-status ${status.valid ? 'status-valid' : 'status-invalid'}`}>
                                {status.icon} {status.msg}
                              </span>
                            </div>
                            <strong className="field-value">
                              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '-')}
                            </strong>
                          </article>
                        );
                      })}
                    </div>
                  </div>

                  {/* Extracted Holidays */}
                  {calendarExcelExtraction.holidays && calendarExcelExtraction.holidays.length > 0 && (
                    <div className="extracted-holidays-section">
                      <h4>Holidays Extracted ({calendarExcelExtraction.holidays.length})</h4>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Holiday Name</th>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calendarExcelExtraction.holidays.map((holiday, idx) => {
                              const isEmpty = !holiday.name || !holiday.date;
                              const status = isEmpty ? { valid: false, icon: '❌', msg: 'Requires editing' } : { valid: true, icon: '✅', msg: 'Ready' };
                              return (
                                <tr key={idx} className={status.valid ? 'valid' : 'needs-review'}>
                                  <td>
                                    <strong>{holiday.name || '[Empty - Requires editing]'}</strong>
                                    {holiday.warning && <p className="holiday-warning">{holiday.warning}</p>}
                                  </td>
                                  <td className={!holiday.date ? 'needs-review' : ''}>{holiday.date || '[Empty - Requires editing]'}</td>
                                  <td>{toTitleCase(holiday.type || 'public')}</td>
                                  <td className="status-cell">
                                    <span className={`status-badge ${status.valid ? 'status-valid' : 'status-invalid'}`}>
                                      {status.icon} {status.msg}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const clientBlocked = calendarExcelExtraction.client_match && calendarExcelExtraction.client_match.excel_client_name && !calendarExcelExtraction.client_match.matched;
                    return (
                      <div className="inline-actions">
                        <button type="button" disabled={clientBlocked} onClick={saveCalendarExcelExtraction}>
                          {clientBlocked ? "Register client first" : "Apply & save"}
                        </button>
                        <button type="button" className="ghost-button danger-button" onClick={resetCalendarExcelUpload}>Cancel</button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>

            <form className="panel calendar-setup-card" onSubmit={saveCalendar}>
              <div id="calendar-form-feedback" className="panel-header">
                <div>
                  <p className="eyebrow">Monthly rules</p>
                  <h2>Working Day Setup</h2>
                </div>
                <span className="pill status-active">{selectedClient?.name || "Client"}</span>
              </div>
              <FormBanner message={calendarFormBanner} />
              <div className="calendar-save-bar">
                <div>
                  <span>Ready to save</span>
                  <strong>{displayedWorkingDays} working days</strong>
                </div>
                <button type="submit">Save working days</button>
              </div>
              <div className="form-grid">
                <label>Client<ClientSelect clients={clients} value={calendarForm.client} onChange={(value) => { setCalendarForm({ ...calendarForm, client: value }); setHolidayForm({ ...holidayForm, client: value }); setCalendarFormBanner(""); }} /></label>
                <label>Year<input type="number" value={calendarForm.year} onChange={(event) => setCalendarForm({ ...calendarForm, year: Number(event.target.value) })} /></label>
                <label>Month<MonthSelect value={calendarForm.month} onChange={(value) => setCalendarForm({ ...calendarForm, month: value })} /></label>
                <label>Working days<input type="number" value={displayedWorkingDays} readOnly title="Auto-filled from Excel or calculated from weekdays and saved holidays" /></label>
              </div>
              <p className="working-days-calculation-note">
                {isDefaultFiveDayWeek(calendarForm)
                  ? `Calculated for a standard 5-day week (Monday–Friday) in ${monthNames[calendarForm.month - 1]} ${calendarForm.year}, minus saved holidays listed above for this month.`
                  : `Calculated from your selected weekdays in ${monthNames[calendarForm.month - 1]} ${calendarForm.year}, minus saved holidays listed above for this month.`}
              </p>
              <div className="weekday-grid">
                {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                  <label key={day} className="check-tile">
                    <input type="checkbox" checked={calendarForm[day]} onChange={(event) => setCalendarForm({ ...calendarForm, [day]: event.target.checked, working_days: currentMonthBreakdown.total })} />
                    <span>{day.toUpperCase()}</span>
                  </label>
                ))}
              </div>
              <label>Weekend policy<select value={calendarForm.weekend_policy} onChange={(event) => setCalendarForm({ ...calendarForm, weekend_policy: event.target.value })}><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></label>

              <section className="working-days-insight" aria-label="Working days calculation">
                <div className="working-days-insight-hero">
                  <div>
                    <span className="insight-label">Suggested for {monthNames[calendarForm.month - 1]} {calendarForm.year}</span>
                    <strong className="insight-value">{displayedWorkingDays}</strong>
                    <span className="insight-unit">working days</span>
                  </div>
                  <div className="insight-formula">
                    <span>{monthCalendarInsight.weekdaySlots} weekday slots</span>
                    <span className="insight-minus">−</span>
                    <span>{monthCalendarInsight.holidayExclusions} holiday exclusions</span>
                    <span className="insight-equals">=</span>
                    <span>{displayedWorkingDays} billable days</span>
                  </div>
                </div>
                <div className="insight-breakdown-grid">
                  <article><span>Calendar days</span><strong>{monthCalendarInsight.daysInMonth}</strong></article>
                  <article><span>Selected weekdays</span><strong>{monthCalendarInsight.weekdaySlots}</strong></article>
                  <article><span>Saved holiday dates</span><strong>{monthCalendarInsight.savedHolidayRows.length}</strong></article>
                  <article><span>Weekend policy</span><strong>{calendarForm.weekend_policy}</strong></article>
                </div>
                {false && (
                  <p className="muted insight-empty">No saved holidays for this month — count uses {isDefaultFiveDayWeek(calendarForm) ? "the standard 5-day week (Mon–Fri)" : "your selected weekdays"} ({monthCalendarInsight.weekdaySlots} days).</p>
                )}
                {false && monthCalendarInsight.indiaReferenceRows.length > 0 && (
                  <div className="holiday-insight-block holiday-insight-reference">
                    <h3>India reference (not yet saved for this client)</h3>
                    <ul className="holiday-insight-list">
                      {monthCalendarInsight.indiaReferenceRows.map((row) => (
                        <li key={row.key}>
                          <span className="holiday-insight-date">{row.date}</span>
                          <span className="holiday-insight-name">{row.name}</span>
                          <button type="button" className="small-button use-holiday-btn" onClick={() => addRecommendedHoliday({ name: row.name, date: row.date, duration_days: 1, type: "public" })}>+ Add</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </form>

            <section className="panel calendar-setup-card india-holidays-panel">
              <div className="panel-header">
                <h2>Holidays in {monthNames[calendarForm.month - 1]} {calendarForm.year}</h2>
                <span className="pill pending">India</span>
              </div>
              <p className="india-holidays-note">Public &amp; gazetted holidays observed in India during this month — use as a reference while adding company-specific holidays below. The list updates when you change month or year.</p>
              <div className="holiday-ref-list-scroll">
                <div className="holiday-ref-list">
                  {selectedIndiaHolidays.map((holiday) => (
                    <article className="holiday-ref-card" key={holiday.date}>
                      <div className="holiday-ref-meta">
                        <span className={`holiday-type-badge type-${holiday.type.toLowerCase().replace(/[^a-z]/g, "-")}`}>{holiday.type}</span>
                        <strong className="holiday-ref-name">{holiday.name}</strong>
                        <span className="holiday-ref-date">{holiday.weekday}, {holiday.day} {monthNames[calendarForm.month - 1]}</span>
                        <span className="holiday-ref-duration">Approx. {formatHolidayDuration(holiday.duration_days)}</span>
                      </div>
                      <button
                        type="button"
                        className="small-button use-holiday-btn"
                        title="Pre-fill the add form with this holiday"
                        onClick={() => addRecommendedHoliday(holiday)}
                      >
                        + Add
                      </button>
                    </article>
                  ))}
                  {selectedIndiaHolidays.length === 0 && (
                    <p className="muted no-holidays-msg holiday-ref-empty">No national holidays recorded for this month. Add company-specific holidays below.</p>
                  )}
                </div>
              </div>

              <div className="add-holiday-section">
                <div className="holiday-manager-header">
                  <div>
                    <p className="add-holiday-title">Add company holiday</p>
                    <p className="muted">Pre-fill from the India list with + Add, or enter details below. Saved holidays are listed at the top of this page.</p>
                  </div>
                  <span className="pill pending">{selectedClientHolidays.length} saved</span>
                </div>
                <form id="holiday-form-feedback" className="add-holiday-form holiday-form-panel" onSubmit={saveHoliday}>
                    <FormBanner message={holidayFormBanner} />
                    <label className={`form-field${holidayFormErrors.name ? " has-error" : ""}`}>
                      Holiday name
                      <input placeholder="e.g. Founders Day" value={holidayForm.name} onChange={(event) => { setHolidayForm({ ...holidayForm, name: event.target.value }); clearHolidayFieldError("name"); }} />
                      <FieldError message={holidayFormErrors.name} />
                    </label>
                    {existingHolidayNameMatch && !holidayFormErrors.name && (
                      <p className="field-hint">This holiday already exists for this client. Saving now will update its date, duration, and type after confirmation.</p>
                    )}
                    <label className={`form-field${holidayFormErrors.date ? " has-error" : ""}`}>
                      Date
                      <input type="date" value={holidayForm.date} onChange={(event) => { setHolidayForm({ ...holidayForm, date: event.target.value }); clearHolidayFieldError("date"); }} />
                      <FieldError message={holidayFormErrors.date} />
                    </label>
                    <label className={`form-field${holidayFormErrors.duration_days ? " has-error" : ""}`}>
                      Duration
                      <input type="number" min="1" value={holidayForm.duration_days} onChange={(event) => { setHolidayForm({ ...holidayForm, duration_days: Math.max(1, Number(event.target.value) || 1) }); clearHolidayFieldError("duration_days"); }} />
                      <FieldError message={holidayFormErrors.duration_days} />
                    </label>
                    <label className={`form-field${holidayFormErrors.type ? " has-error" : ""}`}>
                      Type
                      <select value={holidayForm.type} onChange={(event) => { setHolidayForm({ ...holidayForm, type: event.target.value }); clearHolidayFieldError("type"); }}>
                        <option value="public">Public</option>
                        <option value="company">Company</option>
                      </select>
                      <FieldError message={holidayFormErrors.type} />
                    </label>
                    <button type="submit" className="add-holiday-submit">{existingHolidayNameMatch ? "Update holiday" : "Add holiday"}</button>
                  </form>

              </div>
            </section>
            </div>
          </section>
        )}

        {activeView === "calendarView" && (
          <section className="calendar-view-layout">
            <section className="panel wide-panel">
              <div className="panel-header">
                <h2>Client Calendar</h2>
                <span className="pill pending">{yearSummary.reduce((sum, month) => sum + month.calculated, 0)} days</span>
              </div>
              <div className="form-grid">
                <label>Client<ClientSelect clients={clients} value={calendarForm.client} onChange={(value) => setCalendarForm({ ...calendarForm, client: value })} /></label>
                <label>Year<input type="number" value={calendarForm.year} onChange={(event) => setCalendarForm({ ...calendarForm, year: Number(event.target.value) })} /></label>
                <label>Month<MonthSelect value={calendarForm.month} onChange={(value) => setCalendarForm({ ...calendarForm, month: value })} /></label>
                <label>Working days<input type="number" value={currentMonthBreakdown.total} readOnly /></label>
              </div>
            </section>

            <section className="panel month-breakdown-panel">
              <div className="panel-header">
                <h2>{monthNames[calendarForm.month - 1]} Week View</h2>
                <span className="pill pending">{currentMonthBreakdown.total} days</span>
              </div>
              <div className="month-day-grid">
                {currentMonthBreakdown.days.map((day) => (
                  <article className={day.isWorkingDay ? "day-cell working" : day.isHoliday ? "day-cell holiday" : "day-cell off"} key={day.date}>
                    <span>{day.weekday}</span>
                    <strong>{day.day}</strong>
                    <p>{day.holidayName || (day.isConfiguredWorkday ? "Workday" : "Off")}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel wide-panel">
              <div className="panel-header"><h2>{selectedClient?.name || "Client"} Holidays</h2></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Date</th><th>Duration</th><th>Type</th><th>Client</th><th>Actions</th></tr></thead>
                  <tbody>
                    {selectedClientHolidays.map((holiday) => (
                      <tr key={holiday.id} id={editingHoliday?.id === holiday.id ? `saved-holiday-edit-${holiday.id}` : undefined}>
                        <td>
                          {editingHoliday?.id === holiday.id ? (
                            <>
                              <input value={editingHoliday.name} onChange={(event) => { setEditingHoliday({ ...editingHoliday, name: event.target.value }); clearEditingHolidayField("name"); }} />
                              <FieldError message={editingHolidayErrors.name} />
                            </>
                          ) : (
                            holiday.name
                          )}
                        </td>
                        <td>
                          {editingHoliday?.id === holiday.id ? (
                            <>
                              <input type="date" value={editingHoliday.date} onChange={(event) => { setEditingHoliday({ ...editingHoliday, date: event.target.value }); clearEditingHolidayField("date"); }} />
                              <FieldError message={editingHolidayErrors.date} />
                            </>
                          ) : (
                            formatHolidayRange(holiday)
                          )}
                        </td>
                        <td>
                          {editingHoliday?.id === holiday.id ? (
                            <>
                              <input type="number" min="1" value={editingHoliday.duration_days} onChange={(event) => { setEditingHoliday({ ...editingHoliday, duration_days: Math.max(1, Number(event.target.value) || 1) }); clearEditingHolidayField("duration_days"); }} />
                              <FieldError message={editingHolidayErrors.duration_days} />
                            </>
                          ) : (
                            formatHolidayDuration(holiday.duration_days)
                          )}
                        </td>
                        <td>
                          {editingHoliday?.id === holiday.id ? (
                            <>
                              <select value={editingHoliday.type} onChange={(event) => { setEditingHoliday({ ...editingHoliday, type: event.target.value }); clearEditingHolidayField("type"); }}>
                                <option value="public">Public</option>
                                <option value="company">Company</option>
                              </select>
                              <FieldError message={editingHolidayErrors.type} />
                            </>
                          ) : (
                            holiday.type
                          )}
                        </td>
                        <td>{selectedClient?.name}</td>
                        <td className="table-actions">
                          {editingHoliday?.id === holiday.id ? (
                            <>
                              <button type="button" className="small-button" onClick={updateHoliday}>Save</button>
                              <button type="button" className="small-button ghost-button" onClick={cancelHolidayEdit}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="small-button ghost-button" onClick={() => startHolidayEdit(holiday)}>Edit</button>
                              <button type="button" className="small-button danger-button" title="Remove holiday" onClick={() => deleteHoliday(holiday)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel wide-panel">
              <div className="panel-header"><h2>{calendarForm.year} Working Days Summary</h2><span className="pill pending">{yearSummary.reduce((sum, month) => sum + month.calculated, 0)} days</span></div>
              <p className="muted">The selected month uses the live rules shown above right now. Other months keep their own saved rules, or the default weekday setup if nothing has been saved yet.</p>
              <div className="year-summary-grid">
                {yearSummary.map((month) => (
                  <article className={month.isSelectedMonth ? "year-summary-card live" : "year-summary-card"} key={month.month}>
                    <span>{month.isSelectedMonth ? "Live draft" : month.saved ? "Saved" : "Draft"}</span>
                    <strong>{month.name}</strong>
                    <p>{month.calculated} calculated working days</p>
                    <p>{month.holidays} client holidays</p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeView === "users" && isAdmin && (
          <section className="admin-users-layout">
            <div className="admin-users-top-grid">
              <form className="panel approve-user-form" onSubmit={createUser}>
                <div id="user-form-feedback" className="panel-header">
                  <h2>Approve New User</h2>
                  <button
                    type="button"
                    className="ghost-button header-scroll-btn"
                    onClick={() => scrollToSection("approved-accounts-panel")}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    View Accounts ↓
                  </button>
                </div>
                {userManagementError && <p className="form-banner-error" role="alert">{userManagementError}</p>}
                <label id="user-email-field" className={`form-field${userFormErrors.email ? " has-error" : ""}`}>
                  Email
                  <input type="email" value={userForm.email} onChange={(event) => { setUserForm({ ...userForm, email: event.target.value }); setUserFormErrors((current) => ({ ...current, email: "" })); setUserManagementError(""); }} />
                </label>
                <FieldError message={userFormErrors.email} />
                <label>First name<input value={userForm.first_name} onChange={(event) => setUserForm({ ...userForm, first_name: event.target.value })} /></label>
                <label>Last name<input value={userForm.last_name} onChange={(event) => setUserForm({ ...userForm, last_name: event.target.value })} /></label>
                <label>Role<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}><option value="user">User</option><option value="admin">Admin</option></select></label>
                {userForm.role === "admin" ? (
                  <div className="temporary-password-box compact">
                    <span>Admin access</span>
                    <strong>Full access automatically applied</strong>
                    <p>Admins can manage calendars, users, and security without separate edit toggles.</p>
                  </div>
                ) : (
                  <div className="permission-grid">
                    <label className="toggle-row"><input type="checkbox" checked={userForm.can_edit_calendar_setup} onChange={(event) => setUserForm({ ...userForm, can_edit_calendar_setup: event.target.checked })} />Allow calendar setup editing</label>
                  </div>
                )}
                <div style={{ background: "#f0fbf6", border: "1px solid #b9ead4", borderRadius: "8px", padding: "12px", margin: "8px 0" }}>
                  <p style={{ color: "#004f35", fontSize: "13px", fontWeight: "700", textAlign: "center", margin: 0 }}>
                    ✉️ A temporary password will be automatically generated and emailed to this user's email.
                  </p>
                </div>
                <button type="submit">Create approved account</button>
                <p className="muted" style={{ textAlign: "center", margin: "12px 0 0 0", fontSize: "13px" }}>
                  Approved accounts are listed below. <a href="#approved-accounts-panel" onClick={(e) => { e.preventDefault(); scrollToSection("approved-accounts-panel"); }} style={{ color: "#00633f", fontWeight: "bold", textDecoration: "underline" }}>Scroll to view ↓</a>
                </p>
              </form>
              <article className="panel user-management-guide">
                <div className="panel-header">
                  <h3>📌 Navigation Guide</h3>
                </div>
                <div className="guide-content">
                  <p>Approved user accounts are listed directly below this section.</p>
                  <p className="muted">To manage existing accounts (search, edit permissions, deactivate, reset passwords, or delete):</p>
                  <div className="guide-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => scrollToSection("approved-accounts-panel")}
                      style={{ width: "100%", justifyContent: "center", display: "flex", gap: "8px" }}
                    >
                      <span>Jump to Approved Accounts</span>
                      <span>↓</span>
                    </button>
                  </div>
                  <hr className="divider" />
                  <div className="guide-note" style={{ marginBottom: "14px" }}>
                    <strong>💡 Pro Tip:</strong>
                    <p className="muted">Admins have full access automatically. Regular users can have their calendar edit permissions granted or revoked at any time from the account cards below.</p>
                  </div>
                  
                  {/* Scrollable Pending Password Change Section */}
                  <div className="pending-passwords-container">
                    <div className="pending-passwords-header">
                      <strong>⏳ Pending Password Change</strong>
                      <span className="pending-count-badge">{pendingUsers.length}</span>
                    </div>
                    {pendingUsers.length === 0 ? (
                      <p className="muted" style={{ padding: "12px 0", textAlign: "center", fontStyle: "italic", fontSize: "13px" }}>
                        All active accounts have logged in and set their password.
                      </p>
                    ) : (
                      <div className="pending-passwords-scroll">
                        {pendingUsers.map((pendingAccount) => (
                          <div key={pendingAccount.id} className="pending-user-card">
                            <div className="pending-user-info">
                              <span className="pending-user-email" title={pendingAccount.email}>{pendingAccount.email}</span>
                              <span className="pending-user-role-badge">{pendingAccount.role}</span>
                            </div>
                            <button
                              type="button"
                              className="small-button pending-resend-btn"
                              title="Regenerate and email temporary password"
                              onClick={() => resendPendingPasswordEmail(pendingAccount)}
                            >
                              Resend
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            </div>
            <section id="approved-accounts-panel" className="panel approved-accounts-panel">
              <div className="panel-header">
                <h2>Approved Accounts</h2>
                <button type="button" onClick={loadUsers}>Refresh</button>
              </div>
              <input
                type="text"
                placeholder="Search by email or name..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ margin: "0 0 4px 0" }}
              />
              <div className="approved-accounts-scroll">
              <div className="account-list">
                {!usersLoaded && users.length === 0 ? (
                  <p className="muted" style={{ padding: "16px", textAlign: "center" }}>Loading accounts...</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="muted" style={{ padding: "16px", textAlign: "center" }}>No accounts found.</p>
                ) : (
                  filteredUsers.map((account) => (
                    <article className="account-row" key={account.id}>
                      <div className="account-header-row">
                        <div className="account-email">
                          <strong>{account.email}</strong>
                        </div>
                        <div className="account-badges-inline">
                          <strong className={account.is_active ? "status-active" : "status-inactive"}>{account.is_active ? "Active" : "Inactive"}</strong>
                          {account.role === "admin" ? (
                            <span className="pill status-active">Admin</span>
                          ) : (
                            <span className={account.can_edit_calendar_setup ? "pill status-active" : "pill pending"}>{account.can_edit_calendar_setup ? "Can edit" : "View only"}</span>
                          )}
                        </div>
                      </div>
                      <div className="account-body">
                        <div className="account-info-row">
                          <div className="account-meta">
                            <div><span>Role</span><strong className="role-text">{account.role}</strong></div>
                          </div>
                          {account.must_reset_password && (
                            <p className="account-pending-note">⏳ Must change password on next sign-in</p>
                          )}
                        </div>
                        <div className="account-actions">
                          <button type="button" className="small-button" onClick={() => requestUserReset(account)}>Reset</button>
                          {account.role !== "admin" && (
                            <button
                              type="button"
                              className="small-button ghost-button"
                              onClick={() => updateUserAccount(account, { can_edit_calendar_setup: !account.can_edit_calendar_setup }, `${account.email} calendar access updated.`)}
                            >
                              {account.can_edit_calendar_setup ? "Revoke edit" : "Grant edit"}
                            </button>
                          )}
                          {account.is_active ? (
                            <button type="button" className="small-button danger-button" disabled={account.email === user.email} onClick={() => deactivateUser(account)}>Deactivate</button>
                          ) : (
                            <button type="button" className="small-button" onClick={() => activateUser(account)}>Activate</button>
                          )}
                          <button type="button" className="small-button danger-button" onClick={() => requestDeleteAccount(account)}>Delete</button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
              </div>
            </section>
            {resetPassword.userId && (
              <form ref={resetPanelRef} className="panel reset-panel" autoComplete="on" onSubmit={(event) => {
                event.preventDefault();
                setConfirmDialog({
                  title: "Apply password reset?",
                  message: `Are you sure you want to reset the password for ${resetPassword.email}? This will set a new temporary password and clear their edit permissions.`,
                  confirmLabel: "Apply Reset",
                  onConfirm: async () => {
                    await resetUserPassword(resetPassword.userId);
                  }
                });
              }}>
                <div className="panel-header"><h2>Reset Password</h2><button type="button" className="ghost-button" onClick={() => setResetPassword({ userId: "", email: "", newPassword: "", currentPasswordPreview: "" })}>Close</button></div>
                <p className="muted">{resetPassword.email}</p>
                <div className="temporary-password-box compact">
                  <span>What this reset does</span>
                  <strong>Sets a temporary password and clears extra edit permissions</strong>
                  <p>The user will stay in the system, but if they were not an admin, they will go back to view-only access until you grant edit permissions again.</p>
                </div>
                <label>Temporary password<PasswordField name="new-password" id="admin-reset-password" value={resetPassword.newPassword} onChange={(event) => { setResetPassword({ ...resetPassword, newPassword: event.target.value }); setResetPasswordError(""); }} readOnly autoComplete="new-password" /></label>
                <div className="inline-actions">
                  <button type="button" className="ghost-button" onClick={fillGeneratedResetPassword}>Generate new password</button>
                </div>
                <div style={{ background: "#f0fbf6", border: "1px solid #b9ead4", borderRadius: "8px", padding: "10px", margin: "4px 0" }}>
                  <p style={{ color: "#004f35", fontSize: "12px", fontWeight: "700", textAlign: "center", margin: 0 }}>
                    ✉️ This temporary password will be emailed directly to the user when you click "Apply reset".
                  </p>
                </div>
                {resetPasswordError && <p className="field-error">{resetPasswordError}</p>}
                <button type="submit">Apply reset</button>
              </form>
            )}
            {deleteAccount.userId && (
              <form className="panel reset-panel" onSubmit={(event) => { event.preventDefault(); deleteUserAccount(deleteAccount.userId); }}>
                <div className="panel-header"><h2>Delete Account</h2><button type="button" className="ghost-button" onClick={() => setDeleteAccount({ userId: "", email: "", role: "", password: "", selfDelete: false })}>Close</button></div>
                <p className="muted">
                  {deleteAccount.role === "admin"
                    ? deleteAccount.selfDelete
                      ? "You are about to permanently delete your own admin account. Another active admin must already exist. Enter your current password to confirm."
                      : "You are about to permanently delete another admin account. Another active admin must already exist. Enter your current admin password to confirm."
                    : deleteAccount.selfDelete
                      ? "You are about to permanently delete your own account. Enter your current password to confirm."
                      : "This account will be permanently deleted and access will be revoked until an admin adds this email again."}
                </p>
                <div className="temporary-password-box compact">
                  <span>Deleting account</span>
                  <strong>{deleteAccount.email}</strong>
                </div>
                <label>Current admin password<PasswordField value={deleteAccount.password} onChange={(event) => { setDeleteAccount({ ...deleteAccount, password: event.target.value }); setDeleteAccountError(""); }} autoComplete="current-password" /></label>
                {deleteAccountError && <p className="field-error">{deleteAccountError}</p>}
                <button type="submit" className="danger-button">Delete account permanently</button>
              </form>
            )}
          </section>
        )}

        {activeView === "audit" && isAdmin && (
          <section className="panel audit-panel">
            <div className="panel-header"><h2>Audit Logs</h2><button type="button" onClick={loadAuditLogs}>Refresh</button></div>
            <p className="muted">Admin-only activity history across users, calendars, holidays, and clients.</p>
            <div className="audit-list">
              {auditLogs.map((log) => (
                <article className="audit-card" key={log.id}>
                  <div className="audit-card-top">
                    <div>
                      <strong>{log.action_label}</strong>
                      <span>{log.target_display || `${toTitleCase(log.target_type)} ${log.target_id}`}</span>
                    </div>
                    <span className="pill pending">{new Date(log.created_at).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="audit-meta">
                    <span><strong>Actor:</strong> {log.actor_email}</span>
                    <span><strong>Target type:</strong> {toTitleCase(log.target_type)}</span>
                  </div>
                  {log.detail_lines?.length > 0 && (
                    <ul className="audit-details">
                      {log.detail_lines.map((line, index) => <li key={`${log.id}-${index}`}>{line}</li>)}
                    </ul>
                  )}
                </article>
              ))}
              {auditLogs.length === 0 && <p className="muted">No audit logs yet.</p>}
            </div>
          </section>
        )}

        {activeView === "security" && (
          <section className="panel security-panel">
            <div className="panel-header"><h2>Change Password</h2></div>
            <p className="muted">Policy: minimum 10 characters with uppercase, lowercase, number, and symbol. Passwords expire every 90 days.</p>
            <PasswordExpiryCountdown expiresAt={passwordMeta?.expiresAt} expiresInDays={passwordMeta?.expiresInDays ?? 0} />
              <form className="auth-form narrow" autoComplete="on" onSubmit={submitChangePassword}>
              <input type="email" name="username" autoComplete="username" value={user?.email || ""} readOnly hidden />
              <label>Current password<PasswordField name="current-password" id="security-current-password" value={changePassword.current_password} onChange={(event) => { setChangePassword({ ...changePassword, current_password: event.target.value }); setSecurityError(""); }} autoComplete="current-password" /></label>
              <label>New password<PasswordField name="new-password" id="security-new-password" value={changePassword.new_password} onChange={(event) => { setChangePassword({ ...changePassword, new_password: event.target.value }); setSecurityError(""); }} autoComplete="new-password" /></label>
              {securityError && <p className="field-error">{securityError}</p>}
              <button type="submit">Update password</button>
            </form>
          </section>
        )}

        {confirmDialog && (
          <div className="dialog-backdrop" role="presentation">
            <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
              <h2 id="confirm-dialog-title">{confirmDialog.title}</h2>
              <p>{confirmDialog.message}</p>
              <div className="dialog-actions">
                <button type="button" className="ghost-button" disabled={confirmBusy} onClick={() => setConfirmDialog(null)}>Cancel</button>
                <button
                  type="button"
                  disabled={confirmBusy}
                  onClick={async () => {
                    setConfirmBusy(true);
                    try {
                      await confirmDialog.onConfirm?.();
                      setConfirmDialog(null);
                    } finally {
                      setConfirmBusy(false);
                    }
                  }}
                >
                  {confirmBusy ? "Please wait..." : (confirmDialog.confirmLabel || "Confirm")}
                </button>
              </div>
            </section>
          </div>
        )}

        <button
          type="button"
          className={showBackToTop ? "back-to-top visible" : "back-to-top"}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
        >
          <span />
          Top
        </button>
      </section>

        {toast && (
          <div className="toast-notification" role="status" aria-live="polite">
            <span className="toast-bar" />
            <span className="toast-text">{toast}</span>
          </div>
        )}
    </main>
  );
}

function ClientSelect({ clients, value, onChange, disabled = false }) {
  return (
    <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select client</option>
      {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
    </select>
  );
}

function MonthSelect({ value, onChange, disabled = false }) {
  return (
    <select value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>
      {monthNames.map((month, index) => (
        <option key={month} value={index + 1}>{month}</option>
      ))}
    </select>
  );
}


function MetricCard({ label, value, detail }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><p>{detail}</p></article>;
}

function WorkflowCard({ step, title, text }) {
  return <article className="workflow-card"><span>{step}</span><h3>{title}</h3><p>{text}</p></article>;
}

createRoot(document.getElementById("root")).render(<App />);


