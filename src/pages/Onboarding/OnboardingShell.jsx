import React from "react"
import { TopBar, ProgressBar } from "./OnboardingPrimitives"

export default function OnboardingShell({
  onBack,
  onClose,
  topVariant = "back",
  progress = 0,
  showProgress = true,
  showAside = true,
  asideHeading = "Find your people. Find your night.",
  asideSubheading = "Discover events on and off campus, RSVP with friends, and don't miss the moment.",
  stepKey,
  children,
}) {
  return (
    <main className="onb-root">
      <div className="onb-app">
        {showAside ? (
          <aside className="onb-aside" aria-hidden="true">
            <span className="onb-aside-mark">CE</span>
            <div>
              <h2 className="onb-aside-hero">{asideHeading}</h2>
              <p className="onb-aside-hero-sub">{asideSubheading}</p>
            </div>
            <p className="onb-aside-credit">Campus Event Navigation</p>
          </aside>
        ) : null}
        <div className="onb-frame">
          <TopBar onBack={onBack} onClose={onClose} variant={topVariant} />
          {showProgress ? <ProgressBar value={progress} /> : null}
          <div className="onb-body">
            <div key={stepKey} className="onb-step">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
