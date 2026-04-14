import React from 'react';
import { Heart, MessageCircle, Repeat, Share2, Music, Plus } from 'lucide-react';
import type { EventRecord } from './types/models';

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