import React from 'react';
import { Heart, MessageCircle, Repeat, Share2, Music } from 'lucide-react';
import type { EventRecord } from '@/types/models';

interface DiscoverVideoFeedProps {
  events: EventRecord[];
  savedIds: Set<string>;
  onPressHeart: (event: EventRecord) => void;
  onPressComment: (event: EventRecord) => void;
  onPressShare: (event: EventRecord) => void;
  onPressRepost: (event: EventRecord) => void;
}

export function DiscoverVideoFeed({
  events,
  savedIds,
  onPressHeart,
  onPressComment,
  onPressShare,
  onPressRepost
}: DiscoverVideoFeedProps) {
  if (!events || events.length === 0) return null;

  return (
    <div className="discover-video-feed-container">
      {events.map((event) => {
        if (!event) return null;
        const isSaved = savedIds?.has(String(event.id)) ?? false;

        return (
          <div key={event.id} className="video-feed-item">
            {/* Feed Media Layer */}
            <img
              src={event.flyer_url || event.image_url || '/placeholder-event.jpg'}
              alt={event.title}
              className="video-feed-media"
            />
            <div className="video-feed-overlay" />

            {/* Right-Side Action Rail */}
            <div className="video-feed-actions">
              <button
                className={`video-action-btn ${isSaved ? 'active heart' : ''}`}
                onClick={() => onPressHeart(event)}
              >
                <div className="video-action-icon"><Heart /></div>
                <span className="video-action-count">{event.likes_count ?? '24'}</span>
              </button>
              <button className="video-action-btn" onClick={() => onPressComment(event)}>
                <div className="video-action-icon"><MessageCircle /></div>
                <span className="video-action-count">{event.comments_count ?? '12'}</span>
              </button>
              <button className="video-action-btn" onClick={() => onPressRepost(event)}>
                <div className="video-action-icon"><Repeat /></div>
                <span className="video-action-count">{event.repost_count ?? '3'}</span>
              </button>
              <button className="video-action-btn" onClick={() => onPressShare(event)}>
                <div className="video-action-icon"><Share2 /></div>
                <span className="video-action-count">Share</span>
              </button>
            </div>

            {/* Bottom-Left Content Zone */}
            <div className="video-feed-info">
              <div className="video-creator-row">
                <img src={event.profiles?.avatar_url || '/default-avatar.png'} alt={event.profiles?.name || 'Creator'} className="video-creator-avatar" />
                <span className="video-creator-name">{event.profiles?.name || event.profiles?.username || 'Campus User'}</span>
                <button className="video-follow-btn">Follow</button>
              </div>
              <p className="video-description">
                <strong>{event.title}</strong> — {event.description}
              </p>
              <div className="video-audio-row">
                <Music size={14} className="video-audio-icon" />
                <span className="video-audio-text">Original Audio - {event.profiles?.name || 'Campus'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}