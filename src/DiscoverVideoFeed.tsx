import React from 'react';
import type { EventRecord } from './types/models';

type IconProps = {
  size?: number;
  strokeWidth?: number;
  fill?: string;
  className?: string;
};

const IconBase = ({
  children,
  size = 24,
  strokeWidth = 2,
  fill = 'none',
  className,
}: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const Heart = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M20.8 4.6c-1.6-1.5-4.2-1.4-5.7.2L12 8l-3.1-3.2C7.4 3.2 4.8 3.1 3.2 4.6c-1.8 1.7-1.9 4.6-.2 6.4l9 9 9-9c1.7-1.8 1.6-4.7-.2-6.4Z" />
  </IconBase>
);

const MessageCircle = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-3.8-.9L3 20l1.2-4.8A8.2 8.2 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z" />
  </IconBase>
);

const Repeat = (props: IconProps) => (
  <IconBase {...props}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11V9a3 3 0 0 1 3-3h15" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
  </IconBase>
);

const Share2 = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4" />
    <path d="m15.4 6.5-6.8 4" />
  </IconBase>
);

const Music = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </IconBase>
);

const Plus = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </IconBase>
);

interface DiscoverVideoFeedProps {
  events: EventRecord[];
  savedIds?: Set<string>;
  repostedIds?: Set<string>;
  followingIdSet?: Set<string>;
  onPressHeart?: (event: EventRecord) => void;
  onPressComment?: (event: EventRecord) => void;
  onPressShare?: (event: EventRecord) => void;
  onPressRepost?: (event: EventRecord) => void;
  onPressCreator?: (event: EventRecord) => void;
  onPressFollow?: (event: EventRecord) => void;
}

export function DiscoverVideoFeed({
  events,
  savedIds,
  repostedIds,
  followingIdSet,
  onPressHeart,
  onPressComment,
  onPressShare,
  onPressRepost,
  onPressCreator,
  onPressFollow
}: DiscoverVideoFeedProps) {
  if (!events || events.length === 0) {
    return (
      <div className="discover-video-feed-container">
        <div className="video-feed-empty">
          <p>No videos right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="discover-video-feed-container">
      {events.map((event) => {
        if (!event) return null;
        const eventId = String(event.id);
        const isSaved = savedIds?.has(eventId) ?? false;
        const isReposted = repostedIds?.has(eventId) ?? false;

        // Get creator info safely
        const creatorId = String(event.creatorId || event.created_by || event.creator_id || "");
        const isFollowing = followingIdSet?.has(creatorId) ?? false;
        
        const creatorName = event.creatorName || event.profiles?.name || event.profiles?.username || 'Campus User';
        const creatorAvatar = event.creatorAvatar || event.profiles?.avatar_url || '/default-avatar.png';

        return (
          <article key={event.id} className="video-feed-item">
            {/* Feed Media Layer */}
            <img
              src={event.image || event.flyer_url || event.image_url || '/placeholder-event.jpg'}
              alt={event.title || 'Event'}
              className="video-feed-media"
              draggable={false}
              onError={(e) => {
                e.currentTarget.src = '/placeholder-event.jpg';
              }}
            />
            <div className="video-feed-overlay" />

            {/* Right-Side Action Rail */}
            <div className="video-feed-actions">
              <button
                type="button"
                className={`video-action-btn ${isSaved ? 'active heart' : ''}`}
                onClick={() => onPressHeart?.(event)}
                aria-label={isSaved ? "Unsave event" : "Save event"}
              >
                <div className="video-action-icon">
                  <Heart fill={isSaved ? "currentColor" : "none"} />
                </div>
                <span className="video-action-count">{isSaved ? "1" : "0"}</span>
              </button>
              <button type="button" className="video-action-btn" onClick={() => onPressComment?.(event)} aria-label="Open comments">
                <div className="video-action-icon"><MessageCircle /></div>
                <span className="video-action-count">0</span>
              </button>
              <button type="button" className={`video-action-btn ${isReposted ? 'active repost' : ''}`} onClick={() => onPressRepost?.(event)} aria-label="Repost event">
                <div className="video-action-icon"><Repeat /></div>
                <span className="video-action-count">{isReposted ? "1" : "0"}</span>
              </button>
              <button type="button" className="video-action-btn" onClick={() => onPressShare?.(event)} aria-label="Share event">
                <div className="video-action-icon"><Share2 /></div>
                <span className="video-action-count">Share</span>
              </button>
            </div>

            {/* Bottom-Left Content Zone */}
            <div className="video-feed-info">
              <div className="video-creator-row">
                <button 
                  type="button" 
                  className="video-creator-avatar-btn" 
                  onClick={() => onPressCreator?.(event)}
                  aria-label={`Open ${creatorName} profile`}
                >
                  <img 
                    src={creatorAvatar} 
                    alt={creatorName} 
                    className="video-creator-avatar" 
                    onError={(e) => { e.currentTarget.src = '/default-avatar.png'; }} 
                  />
                  {!isFollowing && (
                    <span className="video-creator-badge" aria-hidden="true">
                      <Plus size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
                <span className="video-creator-name">{creatorName}</span>
                {!isFollowing && (
                  <button type="button" className="video-follow-btn" onClick={() => onPressFollow?.(event)}>
                    Follow
                  </button>
                )}
              </div>
              
              {event.title && (
                <p className="video-description">
                  <strong>{event.title}</strong>{event.description ? ` — ${event.description}` : ''}
                </p>
              )}
              
              <div className="video-audio-row">
                <Music size={14} className="video-audio-icon" />
                <span className="video-audio-text">Original Audio — {creatorName}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
