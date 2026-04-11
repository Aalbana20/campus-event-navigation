import React from "react"

function DiscoverStoryItem({ item, onOpenSuggestion }) {
  const isCurrent = item.kind === "current"
  const isSuggested = item.kind === "suggested"

  const handleClick = () => {
    if (isSuggested && onOpenSuggestion) {
      onOpenSuggestion(item)
    }
  }

  return (
    <button
      type="button"
      className={`discover-story-item ${item.kind} ${item.seen ? "seen" : "unseen"}`}
      onClick={handleClick}
      aria-label={`${item.name} ${item.meta || "story"}`}
    >
      <div className="discover-story-avatar-shell">
        <div className="discover-story-ring">
          <img
            src={item.avatar}
            alt={item.name}
            className="discover-story-avatar"
            onError={(event) => {
              event.currentTarget.src = "/default-avatar.png"
            }}
          />
        </div>

        {isCurrent ? (
          <span className="discover-story-badge current" aria-hidden="true">+</span>
        ) : null}

        {isSuggested ? (
          <span className="discover-story-badge suggested" aria-hidden="true">↗</span>
        ) : null}
      </div>

      <span className="discover-story-label">{isCurrent ? "Your Story" : item.name}</span>
      <span className="discover-story-meta">{item.meta || "Campus"}</span>
    </button>
  )
}

function DiscoverStoriesRow({ items, onOpenSuggestion }) {
  return (
    <section className="discover-stories-panel" aria-label="Discover stories">
      <div className="discover-stories-header">
        <div>
          <p className="discover-stories-eyebrow">Campus Pulse</p>
          <h2 className="discover-stories-title">Stories</h2>
        </div>

        <p className="discover-stories-note">
          Quick social snapshots from people, hosts, and suggested accounts.
        </p>
      </div>

      <div className="discover-stories-track" role="list">
        {items.map((item) => (
          <DiscoverStoryItem
            key={item.id}
            item={item}
            onOpenSuggestion={onOpenSuggestion}
          />
        ))}
      </div>
    </section>
  )
}

export default DiscoverStoriesRow
