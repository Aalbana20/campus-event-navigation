import React, { lazy, Suspense, useEffect, useMemo, useState } from "react"
import "./App.css"
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"

const Home = lazy(() => import("./pages/Home"))
const VideoPosts = lazy(() => import("./pages/VideoPosts"))
const Discover = lazy(() => import("./pages/Discover"))
const Explore = lazy(() => import("./pages/Explore"))
const Messages = lazy(() => import("./pages/Messages"))
const MyEvents = lazy(() => import("./pages/MyEvents"))
const Profile = lazy(() => import("./pages/Profile"))
const PublicProfile = lazy(() => import("./pages/PublicProfile"))
const SignUp = lazy(() => import("./pages/SignUp"))
const Login = lazy(() => import("./pages/Login"))
const Logout = lazy(() => import("./pages/Logout"))
import { useEvents } from "./context/EventContext"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl, syncStoredUserFromSession } from "./profileMedia"
import { supabase } from "./supabaseClient"
import { applyThemeMode, getStoredThemeMode } from "./theme"
import GlobalSearch from "./components/GlobalSearch"

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const usersMatch = (a, b) => {
  if (!a || !b) return false
  if (a.id && b.id) return a.id === b.id
  if (a.username && b.username) return a.username === b.username
  return false
}

const timeAgoLabel = (dateInput) => {
  if (!dateInput) return "now"
  const dateValue = new Date(dateInput)
  if (Number.isNaN(dateValue.getTime())) return "now"

  const diffMs = Date.now() - dateValue.getTime()
  const mins = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (mins < 60) return `${Math.max(1, mins)}m`
  if (hours < 24) return `${hours}h`
  return `${Math.max(1, days)}d`
}

const parseEventDate = (event) => {
  if (event?.eventDate) {
    const parsedIso = new Date(`${event.eventDate}T12:00:00`)
    if (!Number.isNaN(parsedIso.getTime())) return parsedIso
  }

  if (typeof event?.date === "string") {
    const monthDayMatch = event.date.match(/^([A-Za-z]+)\s+(\d{1,2})$/)
    if (monthDayMatch) {
      const monthIndex = MONTH_NAMES.findIndex((month) => month === monthDayMatch[1])
      if (monthIndex >= 0) {
        const year = new Date().getFullYear()
        const parsedMonthDay = new Date(year, monthIndex, Number(monthDayMatch[2]), 12)
        if (!Number.isNaN(parsedMonthDay.getTime())) return parsedMonthDay
      }
    }
  }

  return null
}

function MainLayout() {
  const { savedEvents, allEvents, followingList, followersList, currentUser } = useEvents()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isInboxOpen, setIsInboxOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [notificationFilter, setNotificationFilter] = useState("all")
  const [openNotificationMenuId, setOpenNotificationMenuId] = useState(null)
  const [activeDmThreadId, setActiveDmThreadId] = useState(null)
  const [dmDraftMessage, setDmDraftMessage] = useState("")
  const [dmThreads, setDmThreads] = useState([])
  const [dmMessagesByThread, setDmMessagesByThread] = useState({})
  const [unreadDmThreadIds, setUnreadDmThreadIds] = useState(new Set())
  const defaultAvatar = DEFAULT_AVATAR_URL
  const currentUserId = currentUser?.id

  // Normalize old DM query params into the dedicated messages page.
  useEffect(() => {
    const dmUserId = searchParams.get("thread") || searchParams.get("dm")
    if (!dmUserId || !currentUserId) return

    let isActive = true

    const openWithUser = async () => {
      const existingThread = dmThreads.find((thread) => String(thread.id) === String(dmUserId))

      if (!existingThread) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name, username, avatar_url")
          .eq("id", dmUserId)
          .single()

        if (!isActive) return

        const thread = {
          id: dmUserId,
          name: profile?.name || profile?.username || "User",
          username: profile?.username || "",
          preview: "",
          time: "",
          image: sanitizeAvatarUrl(profile?.avatar_url, defaultAvatar),
        }

        setDmThreads((prev) =>
          prev.some((t) => t.id === dmUserId) ? prev : [thread, ...prev]
        )
      }

      setActiveDmThreadId(dmUserId)
      setDmDraftMessage("")
      setUnreadDmThreadIds((prev) => {
        const next = new Set(prev)
        next.delete(dmUserId)
        return next
      })

      if (location.pathname !== "/messages" || searchParams.get("dm")) {
        navigate(`/messages?thread=${dmUserId}`, { replace: true })
      }
    }

    openWithUser()

    return () => {
      isActive = false
    }
  }, [searchParams, currentUserId, defaultAvatar, dmThreads, location.pathname, navigate])

  // Load DM threads — all users the current user has messaged or been messaged by
  useEffect(() => {
    if (!currentUserId) return

    const loadThreads = async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, recipient_id, read")
        .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)

      if (!msgs || msgs.length === 0) return

      const otherIds = [...new Set(
        msgs.map((m) => m.sender_id === currentUserId ? m.recipient_id : m.sender_id)
      )]

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, username, avatar_url")
        .in("id", otherIds)

      setDmThreads(
        (profiles || []).map((p) => ({
          id: p.id,
          name: p.name || p.username || "User",
          username: p.username,
          preview: "Tap to view conversation",
          time: "",
          image: sanitizeAvatarUrl(p.avatar_url, defaultAvatar),
        }))
      )

      // Seed unread state from DB — threads where any received message is unread
      const unreadSenderIds = new Set(
        msgs
          .filter((m) => m.recipient_id === currentUserId && !m.read)
          .map((m) => m.sender_id)
      )
      if (unreadSenderIds.size > 0) {
        setUnreadDmThreadIds(unreadSenderIds)
      }
    }

    loadThreads()
  }, [currentUserId, defaultAvatar])

  // Load messages when a thread is opened
  useEffect(() => {
    if (!activeDmThreadId || !currentUserId) return

    supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .or(
        `and(sender_id.eq.${currentUserId},recipient_id.eq.${activeDmThreadId}),and(sender_id.eq.${activeDmThreadId},recipient_id.eq.${currentUserId})`
      )
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const formatted = (data || []).map((m) => ({
          id: m.id,
          sender: m.sender_id === currentUserId ? "me" : "them",
          text: m.content,
        }))

        setDmMessagesByThread((prev) => ({ ...prev, [activeDmThreadId]: formatted }))
      })
  }, [activeDmThreadId, currentUserId])

  // Realtime — receive incoming messages live
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`incoming-messages-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const msg = payload.new
          const threadId = msg.sender_id

          setDmMessagesByThread((prev) => ({
            ...prev,
            [threadId]: [
              ...(prev[threadId] || []),
              { id: msg.id, sender: "them", text: msg.content },
            ],
          }))

          // Mark thread as unread
          setUnreadDmThreadIds((prev) => new Set([...prev, threadId]))

          void supabase
            .from("profiles")
            .select("id, name, username, avatar_url")
            .eq("id", threadId)
            .maybeSingle()
            .then(({ data: profile }) => {
              setDmThreads((prev) => {
                const nextThread = {
                  id: threadId,
                  name: profile?.name || profile?.username || "New message",
                  username: profile?.username || "",
                  preview: msg.content,
                  time: "now",
                  image: sanitizeAvatarUrl(profile?.avatar_url, defaultAvatar),
                }

                if (prev.some((thread) => thread.id === threadId)) {
                  return prev.map((thread) =>
                    thread.id === threadId ? { ...thread, ...nextThread } : thread
                  )
                }

                return [...prev, nextThread]
              })
            })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [currentUserId, defaultAvatar])

  const mutualUsers = useMemo(
    () =>
      followingList.filter((followingPerson) =>
        followersList.some((followerPerson) => usersMatch(followerPerson, followingPerson))
      ),
    [followersList, followingList]
  )

  const upcomingEventNotifications = useMemo(() => {
    const startToday = new Date()
    startToday.setHours(0, 0, 0, 0)
    const msPerDay = 1000 * 60 * 60 * 24

    return savedEvents
      .map((event) => {
        const dateValue = parseEventDate(event)
        if (!dateValue) return null

        const diffDays = Math.floor((dateValue.getTime() - startToday.getTime()) / msPerDay)
        if (diffDays < 0 || diffDays > 7) return null

        const label =
          diffDays === 0
            ? "today"
            : diffDays === 1
              ? "tomorrow"
              : `in ${diffDays} days`

        return {
          id: `event-reminder-${event.id}`,
          type: "event_reminder",
          category: "events",
          text: `${event.title || "Your event"} is coming up ${label}`,
          time: `${Math.max(0, diffDays)}d`,
          image: event.image || defaultAvatar,
          eventTab: "calendar",
        }
      })
      .filter(Boolean)
      .slice(0, 3)
  }, [defaultAvatar, savedEvents])

  const followNotifications = useMemo(() => {
    const items = []
    if (followersList.length > 0) {
      const newestFollower = followersList[0]
      items.push({
        id: `follow-${newestFollower.id || newestFollower.username || "1"}`,
        type: "follow",
        category: "following",
        text: `${newestFollower.name || newestFollower.username || "Someone"} started following you`,
        time: newestFollower.followedAt ? timeAgoLabel(newestFollower.followedAt) : "recent",
        image: newestFollower.image || newestFollower.avatar || defaultAvatar,
        username: newestFollower.username || "",
      })
    }

    if (mutualUsers.length > 0) {
      const mutual = mutualUsers[0]
      items.push({
        id: `follow-accepted-${mutual.id || mutual.username || "1"}`,
        type: "follow_accepted",
        category: "requests",
        text: `${mutual.name || mutual.username || "A user"} accepted your follow`,
        time: mutual.acceptedAt ? timeAgoLabel(mutual.acceptedAt) : "recent",
        image: mutual.image || mutual.avatar || defaultAvatar,
        username: mutual.username || "",
      })
    }

    return items
  }, [defaultAvatar, followersList, mutualUsers])

  const eventUpdateNotifications = useMemo(() => {
    return allEvents
      .filter((event) => Boolean(event.updatedAt))
      .slice(0, 2)
      .map((event) => ({
        id: `event-update-${event.id}`,
        type: "event_update",
        category: "events",
        text: `${event.title || "An event"} was updated`,
        time: timeAgoLabel(event.updatedAt),
        image: event.image || defaultAvatar,
        eventTab: "my-events",
      }))
  }, [allEvents, defaultAvatar])

  const notificationSeed = useMemo(() => {
    const mergedReal = [
      ...followNotifications,
      ...upcomingEventNotifications,
      ...eventUpdateNotifications,
    ]

    return mergedReal.slice(0, 8).map((item) => ({ ...item, read: false }))
  }, [eventUpdateNotifications, followNotifications, upcomingEventNotifications])

  const [readIds, setReadIds] = useState(new Set())
  const [deletedIds, setDeletedIds] = useState(new Set())

  const notifications = useMemo(
    () =>
      notificationSeed
        .filter((item) => !deletedIds.has(item.id))
        .map((item) => ({ ...item, read: readIds.has(item.id) })),
    [notificationSeed, readIds, deletedIds]
  )

  const clearAllNotifications = () => {
    setReadIds(new Set(notificationSeed.map((item) => item.id)))
  }

  const markNotificationRead = (id) => {
    setReadIds((prev) => new Set([...prev, id]))
  }

  const unreadNotificationCount = notifications.filter((item) => !item.read).length

  const deleteNotification = (id) => {
    setDeletedIds((prev) => new Set([...prev, id]))
    setOpenNotificationMenuId((prev) => (prev === id ? null : prev))
  }

  const toggleNotificationMenu = (id) => {
    setOpenNotificationMenuId((prev) => (prev === id ? null : id))
  }

  const closeNotificationMenu = () => {
    setOpenNotificationMenuId(null)
  }

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenNotificationMenuId(null)
    }

    document.addEventListener("click", handleClickOutside)
    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [])

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === "all") return notifications
    return notifications.filter((item) => item.category === notificationFilter)
  }, [notificationFilter, notifications])

  const activeDmThread = useMemo(
    () => dmThreads.find((t) => String(t.id) === String(activeDmThreadId)) ?? null,
    [activeDmThreadId, dmThreads]
  )

  const displayDmThreads = useMemo(
    () =>
      dmThreads.map((thread) => {
        const messages = dmMessagesByThread[thread.id] || []
        const latestMessage = messages[messages.length - 1]

        if (!latestMessage) return thread

        return {
          ...thread,
          preview: latestMessage.text,
          time: latestMessage.sender === "me" ? "now" : thread.time,
        }
      }),
    [dmMessagesByThread, dmThreads]
  )

  const selectedDmThread = activeDmThread
    ? displayDmThreads.find((thread) => String(thread.id) === String(activeDmThread.id)) ||
      activeDmThread
    : null

  const openDmThread = (thread) => {
    setActiveDmThreadId(thread.id)
    setDmDraftMessage("")
    setUnreadDmThreadIds((prev) => {
      const next = new Set(prev)
      next.delete(thread.id)
      return next
    })
    navigate(`/messages?thread=${thread.id}`)

    // Persist read state so unread dots don't reappear on reload
    if (currentUserId) {
      supabase
        .from("messages")
        .update({ read: true })
        .eq("recipient_id", currentUserId)
        .eq("sender_id", thread.id)
        .eq("read", false)
        .then(() => {})
    }
  }

  const closeDmThread = () => {
    setActiveDmThreadId(null)
    setDmDraftMessage("")
    if (location.pathname === "/messages") {
      navigate("/messages", { replace: true })
    }
  }

  const handleSendDmMessage = async (event) => {
    event.preventDefault()

    const trimmedMessage = dmDraftMessage.trim()
    if (!trimmedMessage || !selectedDmThread || !currentUserId) return

    // Optimistically add to local state immediately
    const tempId = `temp-${Date.now()}`
    setDmMessagesByThread((prev) => ({
      ...prev,
      [selectedDmThread.id]: [
        ...(prev[selectedDmThread.id] || []),
        { id: tempId, sender: "me", text: trimmedMessage },
      ],
    }))
    setDmDraftMessage("")

    // Persist to Supabase
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: currentUserId, recipient_id: selectedDmThread.id, content: trimmedMessage })
      .select("id")
      .single()

    // Replace temp id with real id from database
    if (!error && data) {
      setDmMessagesByThread((prev) => ({
        ...prev,
        [selectedDmThread.id]: (prev[selectedDmThread.id] || []).map((m) =>
          m.id === tempId ? { ...m, id: data.id } : m
        ),
      }))
    }
  }

  const openInbox = () => {
    setIsInboxOpen(true)
  }

  const handleNotificationSelect = (item) => {
    markNotificationRead(item.id)
    closeNotificationMenu()

    if (item.type === "dm_received" && item.threadId) {
      closeInbox()
      const matchedThread =
        displayDmThreads.find((thread) => String(thread.id) === String(item.threadId)) ||
        dmThreads.find((thread) => String(thread.id) === String(item.threadId))

      if (matchedThread) {
        openDmThread(matchedThread)
      } else {
        navigate(`/messages?thread=${item.threadId}`)
      }
      return
    }

    if ((item.type === "event_reminder" || item.type === "event_update") && item.eventTab) {
      closeInbox()
      navigate(`/events?tab=${item.eventTab}`)
      return
    }

    if ((item.type === "follow" || item.type === "follow_accepted") && item.username) {
      closeInbox()
      navigate(`/profile/${item.username}`)
    }
  }

  const closeInbox = () => {
    setIsInboxOpen(false)
    setOpenNotificationMenuId(null)
  }

  const outletContext = {
    defaultAvatar,
    displayDmThreads,
    unreadDmThreadIds,
    selectedDmThread,
    dmMessagesByThread,
    dmDraftMessage,
    setDmDraftMessage,
    openDmThread,
    closeDmThread,
    handleSendDmMessage,
  }

  return (
    <>
      <nav className="topbar">
        <div className="topbar-left">
          <NavLink
            to="/home"
            className={({ isActive }) => `topbar-item-icon-nav ${isActive ? "active" : ""}`}
            aria-label="Home"
            title="Home"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M8 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </NavLink>

          <NavLink
            to="/video-posts"
            className={({ isActive }) => `topbar-item-icon-nav ${isActive ? "active" : ""}`}
            aria-label="Video and Posts"
            title="Video / Posts"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </NavLink>

          <NavLink
            to="/messages"
            className={({ isActive }) => `topbar-item-icon-nav ${isActive ? "active" : ""}`}
            aria-label="Messages"
            title="Messages"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </NavLink>

          <NavLink
            to="/explore"
            className={({ isActive }) => `topbar-item-icon-nav ${isActive ? "active" : ""}`}
            aria-label="Explore"
            title="Explore"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `topbar-item-icon-nav ${isActive ? "active" : ""}`}
            aria-label="Profile"
            title="Profile"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5.5 19a7 7 0 0 1 13 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </NavLink>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className="navbar-search-btn"
            aria-label="Search"
            onClick={() => setIsSearchOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <button
            type="button"
            className="navbar-bell-btn"
            aria-label="Open notifications"
            onClick={openInbox}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 4.5c-2.9 0-5.25 2.35-5.25 5.25v2.06c0 .63-.25 1.24-.69 1.69l-1.32 1.32a.75.75 0 0 0 .53 1.28h13.46a.75.75 0 0 0 .53-1.28l-1.32-1.32a2.4 2.4 0 0 1-.69-1.69V9.75A5.25 5.25 0 0 0 12 4.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9.75 18a2.25 2.25 0 0 0 4.5 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {unreadNotificationCount > 0 && (
              <span className="navbar-bell-badge">{unreadNotificationCount}</span>
            )}
          </button>
        </div>
      </nav>

      {isSearchOpen && <GlobalSearch onClose={() => setIsSearchOpen(false)} />}

      {isInboxOpen && (
        <div className="inbox-overlay" onClick={closeInbox}>
          <aside className="inbox-panel" onClick={(e) => e.stopPropagation()}>
            <div className="inbox-header">
              <h3>Notifications</h3>
              <button
                type="button"
                className="activity-clear-all-btn"
                onClick={clearAllNotifications}
                disabled={!unreadNotificationCount}
              >
                Clear all
              </button>
            </div>

            <button
              type="button"
              className="inbox-close-btn inbox-close-floating"
              onClick={closeInbox}
              aria-label="Close activity panel"
            >
              ×
            </button>

            <div className="inbox-body">
              <div className="notification-filters">
                <button
                  type="button"
                  className={`notification-filter-chip ${notificationFilter === "all" ? "active" : ""}`}
                  onClick={() => setNotificationFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`notification-filter-chip ${notificationFilter === "following" ? "active" : ""}`}
                  onClick={() => setNotificationFilter("following")}
                >
                  Following
                </button>
                <button
                  type="button"
                  className={`notification-filter-chip ${notificationFilter === "messages" ? "active" : ""}`}
                  onClick={() => setNotificationFilter("messages")}
                >
                  Messages
                </button>
                <button
                  type="button"
                  className={`notification-filter-chip ${notificationFilter === "events" ? "active" : ""}`}
                  onClick={() => setNotificationFilter("events")}
                >
                  Events
                </button>
                <button
                  type="button"
                  className={`notification-filter-chip ${notificationFilter === "requests" ? "active" : ""}`}
                  onClick={() => setNotificationFilter("requests")}
                >
                  Requests
                </button>
              </div>

              {filteredNotifications.length > 0 ? (
                <div className="inbox-list">
                  {filteredNotifications.map((item) => (
                    <div
                      className={`inbox-item notification-item ${item.read ? "read" : "unread"}`}
                      key={item.id}
                      onClick={() => handleNotificationSelect(item)}
                    >
                      <img
                        className="inbox-item-avatar"
                        src={item.image || defaultAvatar}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = defaultAvatar
                        }}
                      />
                      <div className="inbox-item-main">
                        <span className="inbox-item-text">{item.text}</span>
                        <span className="inbox-item-time">{item.time}</span>
                      </div>
                      {!item.read && <span className="notification-unread-dot" aria-hidden="true" />}

                      <button
                        type="button"
                        className="notification-more-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleNotificationMenu(item.id)
                        }}
                        aria-label="More options"
                      >
                        •••
                      </button>

                      {openNotificationMenuId === item.id && (
                        <div className="notification-more-menu" onClick={(e) => e.stopPropagation()}>
                          {!item.read && (
                            <button
                              type="button"
                              onClick={() => {
                                markNotificationRead(item.id)
                                closeNotificationMenu()
                              }}
                            >
                              Mark as read
                            </button>
                          )}

                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              deleteNotification(item.id)
                              closeNotificationMenu()
                            }}
                          >
                            Delete notification
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="notification-empty-state">
                  No notifications in this category yet.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}

      <Outlet context={outletContext} />
    </>
  )
}

function AuthLayout() {
  return <Outlet />
}

function ProtectedRoute({ children, session }) {
  return session ? children : <Navigate to="/auth/login" replace />
}

function PublicRoute({ children, session }) {
  return session ? <Navigate to="/home" replace /> : children
}

function RootRedirect({ session }) {
  return <Navigate to={session ? "/home" : "/auth/login"} replace />
}

function LegacyEventRedirect() {
  const { eventId } = useParams()
  return <Navigate to={`/events/${eventId || ""}`} replace />
}

function App() {
  const [session, setSession] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const syncTheme = () => {
      applyThemeMode(getStoredThemeMode())
    }

    syncTheme()

    const handleSystemThemeChange = () => {
      if (getStoredThemeMode() === "device") {
        syncTheme()
      }
    }

    const handleStorageChange = (event) => {
      if (event.key === "themeMode") {
        syncTheme()
      }
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemThemeChange)
    } else {
      mediaQuery.addListener(handleSystemThemeChange)
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleSystemThemeChange)
      } else {
        mediaQuery.removeListener(handleSystemThemeChange)
      }

      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const initializeSession = async () => {
      try {
        const {
          data: { session: restoredSession },
        } = await supabase.auth.getSession()

        if (!isMounted) return

        setSession(restoredSession)
        await syncStoredUserFromSession(restoredSession)
      } catch (error) {
        if (!isMounted) return

        console.error("Unable to restore Supabase session:", error)
        setSession(null)
        await syncStoredUserFromSession(null)
      } finally {
        if (isMounted) {
          setIsInitializing(false)
        }
      }
    }

    initializeSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)

      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        return
      }

      void syncStoredUserFromSession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (isInitializing) {
    return <div className="loading-screen">Loading...</div>
  }

  return (
    <div className="app">
      <Suspense fallback={<div className="app-page-loading" aria-label="Loading…" />}>
      <Routes>
        <Route path="/" element={<RootRedirect session={session} />} />

        <Route
          element={
            <ProtectedRoute session={session}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<Home />} />
          <Route path="/video-posts" element={<VideoPosts />} />
          <Route path="/discover" element={<Navigate to="/home" replace />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/event/:eventId" element={<LegacyEventRedirect />} />
          <Route path="/events" element={<MyEvents />} />
          <Route path="/events/:eventId" element={<MyEvents />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/create" element={<Navigate to="/events?tab=create" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:username" element={<PublicProfile />} />
        </Route>

        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<RootRedirect session={session} />} />
          <Route
            path="login"
            element={
              <PublicRoute session={session}>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="signup"
            element={
              <PublicRoute session={session}>
                <SignUp />
              </PublicRoute>
            }
          />
          <Route path="logout" element={<Logout />} />
        </Route>

        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/signup" element={<Navigate to="/auth/signup" replace />} />
        <Route path="/logout" element={<Navigate to="/auth/logout" replace />} />

        <Route path="*" element={<RootRedirect session={session} />} />
      </Routes>
      </Suspense>
    </div>
  )
}

export default App
