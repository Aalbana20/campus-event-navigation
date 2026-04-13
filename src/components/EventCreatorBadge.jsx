import React from "react"
import { DEFAULT_AVATAR_URL, getEventCreatorDisplay } from "../profileMedia"

function EventCreatorBadge({ event, className = "", compact = false }) {
  const { creatorAvatar, creatorHandle, creatorName } = getEventCreatorDisplay(event)
  const badgeClassName = [
    "event-creator-badge",
    compact ? "compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={badgeClassName}>
      <img
        src={creatorAvatar}
        alt={creatorName}
        className="event-creator-avatar"
        onError={(eventClick) => {
          eventClick.currentTarget.src = DEFAULT_AVATAR_URL
        }}
      />

      <div className="event-creator-copy">
        <span className="event-creator-name">{creatorName.split(' ')[0] || creatorName}</span>
        {creatorHandle && creatorHandle.toLowerCase() !== creatorName.toLowerCase() ? (
          <span className="event-creator-handle">{creatorHandle}</span>
        ) : null}
      </div>
    </div>
  )
}

export default EventCreatorBadge
