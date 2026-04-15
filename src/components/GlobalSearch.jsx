import React, { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabaseClient"
import { sanitizeAvatarUrl, DEFAULT_AVATAR_URL } from "../profileMedia"
import { useEvents } from "../context/EventContext"

const DEBOUNCE_MS = 280
const MAX_RESULTS = 8

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// GlobalSearch is always mounted — the parent conditionally renders it.
// State starts fresh on each mount because React unmounts/remounts the component.
export default function GlobalSearch({ onClose }) {
  const navigate = useNavigate()
  const { allEvents } = useEvents()
  const inputRef = useRef(null)
  const [query, setQuery] = useState("")
  const [profiles, setProfiles] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const debouncedQuery = useDebounce(query.trim().toLowerCase(), DEBOUNCE_MS)

  // Focus input on first render
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Search profiles remotely; only runs when debouncedQuery has a value
  useEffect(() => {
    if (!debouncedQuery) return

    let active = true

    const fetchProfiles = async () => {
      setIsLoading(true)
      const { data } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .or(`username.ilike.%${debouncedQuery}%,name.ilike.%${debouncedQuery}%`)
        .limit(MAX_RESULTS)
      if (!active) return
      setProfiles(data || [])
      setIsLoading(false)
    }

    fetchProfiles()
    return () => { active = false }
  }, [debouncedQuery])

  // Filter events locally
  const matchedEvents = debouncedQuery
    ? (allEvents || [])
        .filter((event) => {
          const haystack = [
            event.title, event.description, event.location,
            event.locationName, event.locationAddress, event.organizer,
            ...(event.tags || []),
          ].filter(Boolean).join(" ").toLowerCase()
          return haystack.includes(debouncedQuery)
        })
        .slice(0, MAX_RESULTS)
    : []

  const handleSelectEvent = useCallback((event) => {
    navigate("/explore")
    onClose()
    // Small delay so Explore mounts before injecting query
    setTimeout(() => {
      const input = document.querySelector(".explore-search-input")
      if (input) {
        const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        nativeInputSetter.call(input, event.title || "")
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.focus()
      }
    }, 150)
  }, [navigate, onClose])

  const handleSelectProfile = useCallback((profile) => {
    navigate(`/profile/${profile.username || profile.id}`)
    onClose()
  }, [navigate, onClose])

  const displayedProfiles = debouncedQuery ? profiles : []
  const hasResults = matchedEvents.length > 0 || displayedProfiles.length > 0

  return (
    <div className="global-search-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Search">
      <div className="global-search-panel" onClick={(e) => e.stopPropagation()}>
        <div className="global-search-input-wrap">
          <svg className="global-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search events, people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="global-search-input"
            autoComplete="off"
          />
          {isLoading && <span className="global-search-spinner" aria-hidden="true" />}
        </div>

        {debouncedQuery && (
          <div className="global-search-results">
            {!hasResults && !isLoading && (
              <p className="global-search-empty">No results for "{query}"</p>
            )}

            {matchedEvents.length > 0 && (
              <section>
                <p className="global-search-group-label">Events</p>
                {matchedEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="global-search-result-item"
                    onClick={() => handleSelectEvent(event)}
                  >
                    <span className="global-search-result-icon" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </span>
                    <span className="global-search-result-text">
                      <span className="global-search-result-title">{event.title}</span>
                      {event.location && (
                        <span className="global-search-result-sub">{event.location}</span>
                      )}
                    </span>
                  </button>
                ))}
              </section>
            )}

            {displayedProfiles.length > 0 && (
              <section>
                <p className="global-search-group-label">People</p>
                {displayedProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className="global-search-result-item"
                    onClick={() => handleSelectProfile(profile)}
                  >
                    <img
                      src={sanitizeAvatarUrl(profile.avatar_url, DEFAULT_AVATAR_URL)}
                      alt={profile.name || profile.username}
                      className="global-search-result-avatar"
                      onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_URL }}
                    />
                    <span className="global-search-result-text">
                      <span className="global-search-result-title">{profile.name || profile.username}</span>
                      {profile.username && (
                        <span className="global-search-result-sub">@{profile.username}</span>
                      )}
                    </span>
                  </button>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
