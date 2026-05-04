import React from "react"

function DiscoverStoryItem({
  item,
  onOpenStory,
  onOpenCreateStory,
}) {
  const isCurrent = item.kind === "current"
  const hasStories = Array.isArray(item.stories) && item.stories.length > 0

  const handleClick = () => {
    if (isCurrent) {
      if (hasStories) {
        if (onOpenStory) onOpenStory(item)
      } else {
        if (onOpenCreateStory) onOpenCreateStory()
      }
      return
    }

    if (item.kind === "story") {
      if (onOpenStory) onOpenStory(item)
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
          <span
            className="discover-story-badge current"
            aria-hidden="true"
            onClick={(event) => {
              event.stopPropagation()
              if (onOpenCreateStory) {
                onOpenCreateStory()
              }
            }}
          >
            +
          </span>
        ) : null}

      </div>

      <span className="discover-story-label">
        {isCurrent ? "Your Story" : item.username || item.name}
      </span>
    </button>
  )
}

function DiscoverStoriesRow({
  items,
  onOpenStory,
  onOpenCreateStory,
}) {
  return (
    <section className="discover-stories-panel" aria-label="Discover stories">
      <div className="discover-stories-track" role="list">
        {items.map((item) => (
          <DiscoverStoryItem
            key={item.id}
            item={item}
            onOpenStory={onOpenStory}
            onOpenCreateStory={onOpenCreateStory}
          />
        ))}
      </div>
    </section>
  )
}

export default DiscoverStoriesRow
