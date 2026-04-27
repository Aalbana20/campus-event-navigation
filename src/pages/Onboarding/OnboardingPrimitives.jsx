import React from "react"
import { ChevronLeft, X, Check, AlertCircle } from "./icons"

export function TopBar({ onBack, onClose, variant = "back" }) {
  return (
    <div className="onb-topbar">
      {variant === "close" ? (
        <button type="button" className="onb-iconbtn" onClick={onClose} aria-label="Close">
          <X size={22} strokeWidth={2.2} />
        </button>
      ) : onBack ? (
        <button type="button" className="onb-iconbtn" onClick={onBack} aria-label="Back">
          <ChevronLeft size={24} strokeWidth={2.4} />
        </button>
      ) : (
        <span style={{ width: 40 }} />
      )}
    </div>
  )
}

export function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="onb-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="onb-progress-bar" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function PrimaryButton({ children, ...rest }) {
  return <button type="button" className="onb-btn onb-btn-primary" {...rest}>{children}</button>
}
export function LightButton({ children, ...rest }) {
  return <button type="button" className="onb-btn onb-btn-light" {...rest}>{children}</button>
}
export function GhostButton({ children, ...rest }) {
  return <button type="button" className="onb-btn onb-btn-ghost" {...rest}>{children}</button>
}

export function FloatingInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder = " ",
  autoComplete,
  autoFocus,
  state,
  helper,
  helperState,
  rightSlot,
  inputMode,
  maxLength,
  onKeyDown,
}) {
  const stateClass = state === "error" ? "has-error" : state === "success" ? "has-success" : ""
  const helperClass = helperState === "error" ? "is-error" : helperState === "success" ? "is-success" : ""
  return (
    <div className="onb-field">
      <div className={`onb-input-wrap ${stateClass}`}>
        <input
          className="onb-input"
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          inputMode={inputMode}
          maxLength={maxLength}
          onKeyDown={onKeyDown}
        />
        <span className="onb-label">{label}</span>
        {rightSlot ? <span className="onb-input-suffix">{rightSlot}</span> : null}
      </div>
      {helper ? <small className={`onb-helper ${helperClass}`}>{helper}</small> : null}
    </div>
  )
}

export function StatusIcon({ status }) {
  if (status === "checking") return <span className="onb-status-ring checking" />
  if (status === "available" || status === "success")
    return <span className="onb-status-ring success"><Check size={14} strokeWidth={3} /></span>
  if (status === "taken" || status === "error")
    return <span className="onb-status-ring error"><AlertCircle size={14} strokeWidth={2.5} /></span>
  return null
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`onb-chip ${active ? "is-selected" : ""}`}
      onClick={onClick}
      aria-pressed={!!active}
    >
      {children}
    </button>
  )
}

export function Banner({ children, tone = "error" }) {
  if (!children) return null
  return <div className={`onb-banner onb-banner-${tone}`}>{children}</div>
}
