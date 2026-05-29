/** Shared form validation, API error parsing, and scroll-to-error helpers. */

export function scrollToFeedback(anchorId) {
  if (!anchorId) return;
  requestAnimationFrame(() => {
    const anchor = document.getElementById(anchorId);
    if (!anchor) return;
    anchor.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = anchor.querySelector(
      "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[type=submit]"
    );
    if (focusable && typeof focusable.focus === "function") {
      try {
        focusable.focus({ preventScroll: true });
      } catch {
        focusable.focus();
      }
    }
  });
}

function humanizeFieldName(field) {
  return String(field || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeMessage(field, message) {
  const text = String(message || "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower.includes("may not be blank") || lower.includes("this field is required")) {
    return `${humanizeFieldName(field)} is required.`;
  }
  if (field === "date" && lower.includes("wrong format")) {
    return "Use a valid date in YYYY-MM-DD format.";
  }
  if (field === "date" && lower.includes("valid date")) {
    return "Enter a valid date.";
  }
  return text;
}

export function parseApiFieldErrors(error) {
  const fields = {};
  let form = "";
  const data = error?.response?.data;

  if (!data) {
    return { fields, form };
  }

  if (error.response?.status === 403) {
    if (typeof data?.detail === "string") {
      form = data.detail;
    } else {
      form = "You do not have permission to make that change.";
    }
    return { fields, form };
  }

  if (error.response?.status === 409) {
    form = "This record was updated by someone else. Refresh the page and try again.";
    return { fields, form };
  }

  if (typeof data === "string") {
    form = data;
    return { fields, form };
  }

  if (Array.isArray(data)) {
    form = data.join(" ");
    return { fields, form };
  }

  if (typeof data.detail === "string") {
    form = data.detail;
    return { fields, form };
  }

  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
    form = data.non_field_errors.join(" ");
  }

  Object.entries(data).forEach(([key, value]) => {
    if (key === "detail" || key === "non_field_errors") return;
    const combined = Array.isArray(value) ? value.join(" ") : String(value);
    fields[key] = humanizeMessage(key, combined);
  });

  return { fields, form };
}

export function fallbackApiMessage(error, fallback) {
  const { fields, form } = parseApiFieldErrors(error);
  if (form) return form;
  const fieldMessages = Object.values(fields).filter(Boolean);
  if (fieldMessages.length) return fieldMessages.join(" ");
  return fallback;
}

export function validateHolidayForm(form) {
  const errors = {};
  if (!String(form.client || "").trim()) {
    errors.client = "Select a client before adding a holiday.";
  }
  const name = String(form.name || "").trim();
  if (!name) {
    errors.name = "Holiday name is required.";
  } else if (name.length > 50) {
    errors.name = "Holiday name cannot exceed 50 characters.";
  }
  if (!String(form.date || "").trim()) {
    errors.date = "Date is required.";
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(form.date))) {
    errors.date = "Use format YYYY-MM-DD (use the date picker).";
  }
  const duration = Number(form.duration_days);
  if (!duration || duration < 1) {
    errors.duration_days = "Duration must be at least 1 day.";
  } else if (duration > 365) {
    errors.duration_days = "Duration cannot exceed 365 days.";
  }
  return errors;
}

export function validateClientForm(form) {
  const errors = {};
  const name = String(form.name || "").trim();
  if (!name) {
    errors.name = "Client name is required.";
  } else if (name.length > 50) {
    errors.name = "Client name cannot exceed 50 characters.";
  }
  return errors;
}

export function validateEntryForm(form) {
  const errors = {};
  if (!String(form.client || "").trim()) errors.client = "Select a client company.";
  if (!String(form.resource || "").trim()) errors.resource = "Select an employee.";
  if (!form.year) errors.year = "Year is required.";
  if (!form.month) errors.month = "Month is required.";
  return errors;
}

export function validateLoginForm(email, password) {
  const errors = {};
  const emailStr = String(email || "").trim();
  const passwordStr = String(password || "").trim();
  if (!emailStr) {
    errors.email = "Email is required.";
  } else if (emailStr.length > 60) {
    errors.email = "Email cannot exceed 60 characters.";
  }
  if (!passwordStr) {
    errors.password = "Password is required.";
  } else if (passwordStr.length > 64) {
    errors.password = "Password cannot exceed 64 characters.";
  }
  return errors;
}

export function validateResetEmailForm(email) {
  const errors = {};
  const emailStr = String(email || "").trim();
  if (!emailStr) {
    errors.email = "Email is required.";
  } else if (emailStr.length > 60) {
    errors.email = "Email cannot exceed 60 characters.";
  }
  return errors;
}

export function validatePasswordResetForm(password) {
  const errors = {};
  if (!String(password || "").trim()) errors.password = "New password is required.";
  return errors;
}

export function hasFieldErrors(errors) {
  return Object.values(errors || {}).some(Boolean);
}
