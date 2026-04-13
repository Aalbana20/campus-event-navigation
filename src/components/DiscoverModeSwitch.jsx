import React from "react"

const OPTIONS = [
  { id: "events", label: "Events" },
  { id: "friends", label: "Discover" },
]

function DiscoverModeSwitch({ activeMode, onChange }) {
  return (
    <div
      className="discover-mode-switch"
      role="tablist"
      aria-label="Discover mode"
      data-mode={activeMode}
    >
      <div className="discover-mode-switch-indicator" aria-hidden="true" />

      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={activeMode === option.id}
          className={`discover-mode-switch-option ${activeMode === option.id ? "active" : ""}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default DiscoverModeSwitch
