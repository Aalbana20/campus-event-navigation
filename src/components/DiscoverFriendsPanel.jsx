import React from "react"

function DiscoverFriendsPanel({
  items,
  followingIds,
  onOpenPerson,
  onToggleFollow,
}) {
  return (
    <section className="discover-friends-panel" aria-label="Friends discovery">
      <div className="discover-friends-intro">
        <div>
          <p className="discover-friends-eyebrow">Social Discovery</p>
          <h2 className="discover-friends-title">Friends</h2>
        </div>

        <p className="discover-friends-note">
          People shaping the campus scene through events, circles, and momentum.
        </p>
      </div>

      <div className="discover-friends-grid">
        {items.map((person) => {
          const isFollowing = person.canToggleFollow && followingIds.has(String(person.profileId))
          const actionLabel = person.canToggleFollow
            ? isFollowing
              ? "Following"
              : "Follow"
            : "Suggested"

          return (
            <article
              key={person.id}
              className={`discover-friend-card ${person.featured ? "featured" : ""}`}
            >
              <button
                type="button"
                className="discover-friend-card-main"
                onClick={() => onOpenPerson(person)}
                disabled={!person.routeKey}
              >
                <div className="discover-friend-card-top">
                  <div className="discover-friend-identity">
                    <img
                      src={person.avatar}
                      alt={person.name}
                      className="discover-friend-avatar"
                      onError={(event) => {
                        event.currentTarget.src = "/default-avatar.png"
                      }}
                    />

                    <div className="discover-friend-name-wrap">
                      <h3>{person.name}</h3>
                      {person.username ? (
                        <p>@{person.username}</p>
                      ) : null}
                    </div>
                  </div>

                  <span className="discover-friend-badge">{person.badge}</span>
                </div>

                <p className="discover-friend-headline">{person.headline}</p>
                <p className="discover-friend-context">{person.context}</p>

                <div className="discover-friend-meta-row">
                  {person.metaItems.map((item) => (
                    <span key={`${person.id}-${item}`} className="discover-friend-meta-pill">
                      {item}
                    </span>
                  ))}
                </div>
              </button>

              <div className="discover-friend-card-footer">
                <button
                  type="button"
                  className={`discover-friend-action ${isFollowing ? "active" : ""}`}
                  disabled={!person.canToggleFollow}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleFollow(person, isFollowing)
                  }}
                >
                  {actionLabel}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default DiscoverFriendsPanel
