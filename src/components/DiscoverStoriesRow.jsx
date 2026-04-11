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
      aria-label={`${item.username || item.name} story`}
    >
      <div className="discover-story-avatar-shell">
        <div className="discover-story-ring">
          <img
            src={item.avatar}
            alt={item.username || item.name}
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

      <span className="discover-story-label">{isCurrent ? "Your Story" : (item.username || item.name)}</span>
    </button>
  )
}

function DiscoverStoriesRow({ items, onOpenSuggestion }) {
  return (
    <section className="discover-stories-panel" aria-label="Discover stories">
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
