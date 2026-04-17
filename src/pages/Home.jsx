import React, { lazy, Suspense } from "react"
import { useSearchParams } from "react-router-dom"
import SegmentedToggle from "../components/SegmentedToggle"

const Discover = lazy(() => import("./Discover"))
const MyEvents = lazy(() => import("./MyEvents"))

const HOME_VIEWS = [
  { id: "events", label: "Events" },
  { id: "calendar", label: "Calendar" },
]

const HOME_VIEW_IDS = HOME_VIEWS.map((view) => view.id)

function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawView = searchParams.get("view")
  const activeView = HOME_VIEW_IDS.includes(rawView) ? rawView : "events"

  const handleChangeView = (nextView) => {
    if (!HOME_VIEW_IDS.includes(nextView) || nextView === activeView) return

    const nextParams = new URLSearchParams(searchParams)
    if (nextView === "events") {
      nextParams.delete("view")
    } else {
      nextParams.set("view", nextView)
    }
    setSearchParams(nextParams, { replace: false })
  }

  return (
    <div className="home-page">
      <div className="segmented-toggle-wrap">
        <SegmentedToggle
          options={HOME_VIEWS}
          value={activeView}
          onChange={handleChangeView}
          ariaLabel="Home view"
        />
      </div>

      <Suspense fallback={<div className="app-page-loading" aria-label="Loading…" />}>
        {activeView === "events" ? (
          <Discover hideModeSwitch initialMode="events" />
        ) : (
          <MyEvents />
        )}
      </Suspense>
    </div>
  )
}

export default Home
