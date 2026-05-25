import React from "react";

export function FormBanner({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="form-banner-error" role="alert">
      {message}
    </p>
  );
}

export function FieldError({ message, id }) {
  if (!message) return null;
  return (
    <span id={id} className="field-error" role="alert">
      {message}
    </span>
  );
}

export function FormField({ label, htmlFor, error, children, className = "" }) {
  return (
    <label className={`form-field${error ? " has-error" : ""}${className ? ` ${className}` : ""}`} htmlFor={htmlFor}>
      {label}
      {children}
      <FieldError message={error} />
    </label>
  );
}
