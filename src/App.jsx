import React, { useEffect, useMemo, useState } from "react"
import "./App.css"
import { Routes, Route, Link, Navigate, Outlet } from "react-router-dom"
import Discover from "./pages/Discover"
import MyEvents from "./pages/MyEvents"
import Profile from "./pages/Profile"
import CreateEvent from "./CreateEvent"
import SignUp from "./pages/SignUp"
import Login from "./pages/Login"
import Logout from "./pages/Logout"
import { useEvents } from "./context/EventContext"
import { supabase } from "./supabaseClient"

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

const createStoredUser = (user) => {
  if (!user) return null

  const email = user.email || ""
  const fallbackUsername = email.includes("@") ? email.split("@")[0] : "campus-user"
  const username =
    user.user_metadata?.username ||
    user.user_metadata?.user_name ||
    user.user_metadata?.name ||
    fallbackUsername

  return {
    id: user.id,
    email,
    name:
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.username ||
      username,
    username,
    image:
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      user.user_metadata?.image ||
      "",
  }
}

const syncStoredUser = (session) => {
  if (session?.user) {
    localStorage.setItem("user", JSON.stringify(createStoredUser(session.user)))
    return
  }

  localStorage.removeItem("user")
}

function MainLayout() {
  const { savedEvents, allEvents, followingList, followersList } = useEvents()
  const [isInboxOpen, setIsInboxOpen] = useState(false)
  const [activeInboxTab, setActiveInboxTab] = useState("notifications")
  const [notificationFilter, setNotificationFilter] = useState("all")
  const [openNotificationMenuId, setOpenNotificationMenuId] = useState(null)
  const defaultAvatar = "/default-avatar.png"

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
      }))
  }, [allEvents, defaultAvatar])

  const mockNotifications = useMemo(
    () => [
      {
        id: "mock-follow",
        type: "follow",
        category: "following",
        text: "Jordan started following you",
        time: "1d",
        image: defaultAvatar,
      },
      {
        id: "mock-follow-accepted",
        type: "follow_accepted",
        category: "requests",
        text: "Taylor accepted your follow request",
        time: "2d",
        image: defaultAvatar,
      },
      {
        id: "mock-dm",
        type: "dm_received",
        category: "messages",
        text: "Alex sent you a message",
        time: "3h",
        image: defaultAvatar,
      },
      {
        id: "mock-event-reminder",
        type: "event_reminder",
        category: "events",
        text: "Hackathon Night starts tomorrow",
        time: "1d",
        image: defaultAvatar,
      },
      {
        id: "mock-event-update",
        type: "event_update",
        category: "events",
        text: "Campus Party changed locations",
        time: "4h",
        image: defaultAvatar,
      },
    ],
    [defaultAvatar]
  )

  const notificationSeed = useMemo(() => {
    const mergedReal = [
      ...followNotifications,
      ...upcomingEventNotifications,
      ...eventUpdateNotifications,
    ]

    if (mergedReal.length >= 5) {
      return mergedReal.slice(0, 8).map((item) => ({ ...item, read: false }))
    }

    const byId = new Set(mergedReal.map((item) => item.id))
    const missing = mockNotifications.filter((item) => !byId.has(item.id))
    return [...mergedReal, ...missing].slice(0, 8).map((item) => ({ ...item, read: false }))
  }, [eventUpdateNotifications, followNotifications, mockNotifications, upcomingEventNotifications])

  const [notifications, setNotifications] = useState(notificationSeed)

  useEffect(() => {
    setNotifications((prev) =>
      notificationSeed.map((item) => {
        const existing = prev.find((prevItem) => prevItem.id === item.id)
        return existing ? { ...item, read: existing.read } : item
      })
    )
  }, [notificationSeed])

  const clearAllNotifications = () => {
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        read: true,
      }))
    )
  }

  const markNotificationRead = (id) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    )
  }

  const unreadNotificationCount = notifications.filter((item) => !item.read).length

  const deleteNotification = (id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id))
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

  const dmThreads = useMemo(() => {
    const liveFromFollowers = followersList.slice(0, 3).map((person, index) => ({
      id: person.id || person.username || `f-${index}`,
      name: person.name || person.username || "Campus Friend",
      preview: "You still going to the event?",
      time: "recent",
      image: person.image || person.avatar || defaultAvatar,
    }))

    if (liveFromFollowers.length > 0) {
      return liveFromFollowers
    }

    return [
      {
        id: "dm-1",
        name: "Jordan",
        preview: "You still going to the event?",
        time: "2m",
        image: defaultAvatar,
      },
      {
        id: "dm-2",
        name: "Taylor",
        preview: "I RSVP’d already",
        time: "1h",
        image: defaultAvatar,
      },
      {
        id: "dm-3",
        name: "Morgan",
        preview: "Send me the flyer",
        time: "5h",
        image: defaultAvatar,
      },
    ]
  }, [defaultAvatar, followersList])

  const openInbox = () => setIsInboxOpen(true)
  const closeInbox = () => {
    setIsInboxOpen(false)
    setOpenNotificationMenuId(null)
  }

  return (
    <>
      <nav className="topbar">
        <div className="topbar-left">
          <Link className="topbar-item" to="/discover">Discover</Link>
          <Link className="topbar-item" to="/events">My Events</Link>
          <Link className="topbar-item" to="/create">Create Event</Link>
          <Link className="topbar-item" to="/profile">Profile</Link>
        </div>

        <div className="topbar-right">
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

      {isInboxOpen && (
        <div className="inbox-overlay" onClick={closeInbox}>
          <aside className="inbox-panel" onClick={(e) => e.stopPropagation()}>
            <div className="inbox-header">
              <h3>Activity</h3>
              <button
                type="button"
                className="inbox-close-btn"
                onClick={closeInbox}
                aria-label="Close activity panel"
              >
                ×
              </button>
            </div>

            <div className="activity-top-row">
              <div className="activity-main-tabs inbox-tabs">
                <button
                  type="button"
                  className={activeInboxTab === "notifications" ? "active" : ""}
                  onClick={() => setActiveInboxTab("notifications")}
                >
                  Notifications
                </button>
                <button
                  type="button"
                  className={activeInboxTab === "dms" ? "active" : ""}
                  onClick={() => setActiveInboxTab("dms")}
                >
                  DMs
                </button>
              </div>

              {activeInboxTab === "notifications" && (
                <button
                  type="button"
                  className="activity-clear-all-btn"
                  onClick={clearAllNotifications}
                  disabled={!unreadNotificationCount}
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="inbox-body">
              {activeInboxTab === "notifications" && (
                <>
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
                          onClick={closeNotificationMenu}
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
                </>
              )}

              {activeInboxTab === "dms" && (
                <div className="inbox-list">
                  {dmThreads.map((thread) => (
                    <div className="inbox-item" key={thread.id}>
                      <img
                        className="inbox-item-avatar"
                        src={thread.image || defaultAvatar}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = defaultAvatar
                        }}
                      />
                      <div className="inbox-item-main">
                        <span className="inbox-item-text">{thread.name}</span>
                        <span className="inbox-item-preview">{thread.preview}</span>
                        <span className="inbox-item-time">{thread.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <Outlet />
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
  return session ? <Navigate to="/discover" replace /> : children
}

function RootRedirect({ session }) {
  return <Navigate to={session ? "/discover" : "/auth/login"} replace />
}

function App() {
  const [session, setSession] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    let isMounted = true

    const initializeSession = async () => {
      try {
        const {
          data: { session: restoredSession },
        } = await supabase.auth.getSession()

        if (!isMounted) return

        setSession(restoredSession)
        syncStoredUser(restoredSession)
      } catch (error) {
        if (!isMounted) return

        console.error("Unable to restore Supabase session:", error)
        setSession(null)
        syncStoredUser(null)
      } finally {
        if (isMounted) {
          setIsInitializing(false)
        }
      }
    }

    initializeSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      syncStoredUser(nextSession)
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
      <Routes>
        <Route path="/" element={<RootRedirect session={session} />} />

        <Route
          element={
            <ProtectedRoute session={session}>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/discover" element={<Discover />} />
          <Route path="/events" element={<MyEvents />} />
          <Route path="/create" element={<CreateEvent />} />
          <Route path="/profile" element={<Profile />} />
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
    </div>
  )
}

export default App
