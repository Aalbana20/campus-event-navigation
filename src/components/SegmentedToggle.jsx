import React from "react"

function SegmentedToggle({
  options,
  value,
  onChange,
  ariaLabel = "Segmented toggle",
  className = "",
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value)
  )

  return (
    <div
      className={`segmented-toggle ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
      data-position={activeIndex}
      data-count={options.length}
      style={{ "--segmented-count": options.length }}
    >
      <div className="segmented-toggle-indicator" aria-hidden="true" />

      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={`segmented-toggle-option ${value === option.id ? "active" : ""}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export default SegmentedToggle
