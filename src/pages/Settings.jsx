import React, { useMemo } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useEvents } from "../context/EventContext"
import "./Settings.css"

const SETTINGS_GROUPS = [
  {
    title: "Your account",
    items: [
      {
        id: "accounts",
        label: "Accounts Center",
        description: "Password, security, personal details, connected experiences.",
        icon: "user",
      },
      {
        id: "edit-profile",
        label: "Edit profile",
        description: "Name, username, photo, bio, campus details.",
        icon: "person",
        route: "/edit-profile",
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Event reminders, followers, posts, and messages.",
        icon: "bell",
      },
    ],
  },
  {
    title: "For hosts and creators",
    items: [
      { id: "professional", label: "Professional account", icon: "store" },
      { id: "creator-tools", label: "Creator tools and controls", icon: "chart" },
      { id: "campus-payments", label: "Campus payments", icon: "card" },
    ],
  },
  {
    title: "Who can see your content",
    items: [
      { id: "privacy", label: "Account privacy", icon: "lock" },
      { id: "close-friends", label: "Close friends", icon: "star" },
      { id: "blocked", label: "Blocked", icon: "ban" },
      { id: "story-location", label: "Story and location", icon: "pin" },
    ],
  },
  {
    title: "How others can interact with you",
    items: [
      { id: "messages", label: "Messages and story replies", icon: "send" },
      { id: "tags", label: "Tags and mentions", icon: "tag" },
      { id: "comments", label: "Comments", icon: "comment" },
      { id: "sharing", label: "Sharing and reuse", icon: "repeat" },
      { id: "restricted", label: "Restricted accounts", icon: "eye-off" },
      { id: "hidden-words", label: "Hidden Words", icon: "type" },
    ],
  },
  {
    title: "What you see",
    items: [
      { id: "muted", label: "Muted accounts", icon: "mute" },
      { id: "content-preferences", label: "Content preferences", icon: "folder" },
      { id: "like-counts", label: "Like and share counts", icon: "heart-off" },
    ],
  },
  {
    title: "Your app and media",
    items: [
      { id: "archive", label: "Archiving and downloading", icon: "download" },
      { id: "accessibility", label: "Accessibility", icon: "accessibility" },
      { id: "language", label: "Language", icon: "language" },
      { id: "permissions", label: "Website permissions", icon: "window" },
    ],
  },
  {
    title: "More info and support",
    items: [
      { id: "help", label: "Help", icon: "help" },
      { id: "privacy-center", label: "Privacy Center", icon: "shield" },
      { id: "account-status", label: "Account Status", icon: "status" },
    ],
  },
  {
    title: "Login",
    items: [
      {
        id: "logout",
        label: "Log out",
        description: "Sign out of this device.",
        icon: "logout",
        route: "/auth/logout",
        danger: true,
      },
    ],
  },
]

const PANEL_COPY = {
  accounts: {
    title: "Accounts Center",
    description: "Manage your sign-in details and connected Campus Event Navigation experiences.",
    rows: ["Password and security", "Personal details", "Account ownership and control"],
  },
  notifications: {
    title: "Notifications",
    description: "Choose what should get your attention across campus activity.",
    rows: ["Event reminders", "Follower alerts", "Direct messages", "Post engagement"],
  },
  professional: {
    title: "Professional account",
    description: "Tools for hosts, organizations, and creators on campus.",
    rows: ["Account category", "Profile display", "Insights access"],
  },
  "creator-tools": {
    title: "Creator tools and controls",
    description: "Prepare space for scheduling, analytics, and creator workflow settings.",
    rows: ["Post controls", "Saved replies", "Creator dashboard"],
  },
  "campus-payments": {
    title: "Campus payments",
    description: "Future home for event payouts, ticketing, and campus payment settings.",
    rows: ["Payment methods", "Payout details", "Purchase history"],
  },
  privacy: {
    title: "Account privacy",
    description: "Control who can discover your profile and campus activity.",
    rows: ["Private profile", "Activity status", "Followers-only messages"],
  },
  "close-friends": {
    title: "Close friends",
    description: "Manage a smaller audience for selected stories and posts.",
    rows: ["Close friends list", "Suggested people", "Audience defaults"],
  },
  blocked: {
    title: "Blocked",
    description: "People you block cannot view or interact with your profile.",
    rows: ["Blocked accounts", "Block new account", "Review recent blocks"],
  },
  "story-location": {
    title: "Story and location",
    description: "Decide when stories and event memories can include location context.",
    rows: ["Story visibility", "Location sharing", "Campus map mentions"],
  },
  messages: {
    title: "Messages and story replies",
    description: "Set who can message you and how replies should appear.",
    rows: ["Message requests", "Read receipts", "Online status"],
  },
  tags: {
    title: "Tags and mentions",
    description: "Review who can tag you in posts, memories, and campus events.",
    rows: ["Allow tags from", "Manual tag approval", "Mention controls"],
  },
  comments: {
    title: "Comments",
    description: "Shape the conversation around your posts and videos.",
    rows: ["Allow comments from", "Comment filters", "Pinned comment controls"],
  },
  sharing: {
    title: "Sharing and reuse",
    description: "Manage reposting, sharing, and reuse of your campus content.",
    rows: ["Allow reposts", "Allow story sharing", "Share link previews"],
  },
  restricted: {
    title: "Restricted accounts",
    description: "Quietly limit interactions from selected accounts.",
    rows: ["Restricted accounts", "Review interactions", "Message filtering"],
  },
  "hidden-words": {
    title: "Hidden Words",
    description: "Filter words and phrases from comments or message requests.",
    rows: ["Custom words", "Advanced comment filtering", "Message request filters"],
  },
  muted: {
    title: "Muted accounts",
    description: "Hide posts or stories from accounts without unfollowing them.",
    rows: ["Muted posts", "Muted stories", "Muted messages"],
  },
  "content-preferences": {
    title: "Content preferences",
    description: "Tune recommendations for events, posts, and campus discovery.",
    rows: ["Event interests", "Post recommendations", "Sensitive content controls"],
  },
  "like-counts": {
    title: "Like and share counts",
    description: "Choose how public engagement metrics appear around your content.",
    rows: ["Show like counts", "Show share counts", "Default post metrics"],
  },
  archive: {
    title: "Archiving and downloading",
    description: "Download your data and manage older stories or memories.",
    rows: ["Download your information", "Archive posts", "Archive stories"],
  },
  accessibility: {
    title: "Accessibility",
    description: "Adjust motion, contrast, alt text, and assistive settings.",
    rows: ["Reduced motion", "Alt text prompts", "Keyboard navigation"],
  },
  language: {
    title: "Language",
    description: "Choose the language used across the web app.",
    rows: ["App language", "Translation preferences", "Campus locale"],
  },
  permissions: {
    title: "Website permissions",
    description: "Review browser permissions used by the web app.",
    rows: ["Camera", "Microphone", "Notifications", "Location"],
  },
  help: {
    title: "Help",
    description: "Find support for your account and campus experience.",
    rows: ["Support inbox", "Report a problem", "Safety resources"],
  },
  "privacy-center": {
    title: "Privacy Center",
    description: "Learn how privacy and safety settings work across the app.",
    rows: ["Privacy guide", "Data policy", "Safety controls"],
  },
  "account-status": {
    title: "Account Status",
    description: "Review account health, eligibility, and policy notices.",
    rows: ["Account standing", "Feature eligibility", "Recent notices"],
  },
}

function SettingsIcon({ name }) {
  const commonProps = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  }
  const isLock = name === "lock" || name === "shield"
  const isSend = name === "send" || name === "sharing"
  const isUser = name === "user" || name === "person"
  const isText = name === "type" || name === "language"
  const isCircle = name === "bell" || name === "comment" || name === "help" || name === "status"

  return (
    <span className="settings-nav-icon" aria-hidden="true">
      <svg {...commonProps}>
        {isLock ? (
          <>
            <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : isSend ? (
          <path d="m4 12 16-7-7 16-2-7-7-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        ) : isUser ? (
          <>
            <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5.5 20a6.7 6.7 0 0 1 13 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : isText ? (
          <>
            <path d="M5 7h14M8 7v10M16 7v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M7 17h4M13 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : name === "repeat" ? (
          <path d="M17 7H8a4 4 0 0 0-4 4m3-4-3 3 3 3m0 4h9a4 4 0 0 0 4-4m-3 4 3-3-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : name === "download" ? (
          <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : name === "tag" ? (
          <path d="M4 5h8l8 8-7 7-8-8V5Zm5 4h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : name === "logout" ? (
          <>
            <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m16 17 5-5-5-5M21 12H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : isCircle ? (
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
        ) : (
          <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
    </span>
  )
}

function ToggleRow({ label, description }) {
  return (
    <div className="settings-toggle-card">
      <div>
        <strong>{label}</strong>
        {description && <p>{description}</p>}
      </div>
      <span className="settings-faux-toggle" aria-hidden="true" />
    </div>
  )
}

function Settings() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentUser } = useEvents()
  const activeSection = searchParams.get("section") || "edit-profile"
  const activePanel = PANEL_COPY[activeSection] || PANEL_COPY.notifications

  const flatItems = useMemo(
    () => SETTINGS_GROUPS.flatMap((group) => group.items),
    []
  )
  const activeItem = flatItems.find((item) => item.id === activeSection)

  const handleNavItem = (item) => {
    if (item.route) {
      navigate(item.route)
      return
    }
    setSearchParams({ section: item.id })
  }

  return (
    <main className="settings-page">
      <aside className="settings-sidebar" aria-label="Settings navigation">
        <div className="settings-sidebar-header">
          <h1>Settings</h1>
          <label className="settings-search">
            <span className="settings-search-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
                <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <input type="search" placeholder="Search" aria-label="Search settings" />
          </label>
        </div>

        <div className="settings-nav-list">
          {SETTINGS_GROUPS.map((group) => (
            <section className="settings-nav-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`settings-nav-row ${activeSection === item.id ? "active" : ""} ${item.danger ? "is-danger" : ""}`}
                  onClick={() => handleNavItem(item)}
                >
                  <SettingsIcon name={item.icon} />
                  <span>
                    <strong>{item.label}</strong>
                    {item.description && <em>{item.description}</em>}
                  </span>
                </button>
              ))}
            </section>
          ))}
        </div>
      </aside>

      <section className="settings-main-panel">
        {activeSection === "edit-profile" ? (
          <>
            <div className="settings-panel-heading">
              <p>Profile</p>
              <h2>Edit profile</h2>
            </div>

            <div className="settings-profile-card">
              <img src={currentUser?.image || currentUser?.avatar || "/default-avatar.png"} alt="" />
              <div>
                <strong>{currentUser?.username || "campus_user"}</strong>
                <span>{currentUser?.name || "Campus User"}</span>
              </div>
              <Link className="settings-primary-link" to="/edit-profile">
                Open editor
              </Link>
            </div>

            <div className="settings-stack">
              <ToggleRow
                label="Public profile preview"
                description="Review the profile details other students and hosts can see."
              />
              <ToggleRow
                label="Profile links"
                description="Website and campus links are structured here for future account wiring."
              />
              <ToggleRow
                label="Profile suggestions"
                description="Choose whether similar campus accounts can be suggested from your profile."
              />
            </div>
          </>
        ) : (
          <>
            <div className="settings-panel-heading">
              <p>{activeItem?.label || "Settings"}</p>
              <h2>{activePanel.title}</h2>
              <span>{activePanel.description}</span>
            </div>

            <div className="settings-stack">
              {activePanel.rows.map((row) => (
                <ToggleRow
                  key={row}
                  label={row}
                  description="Structured placeholder ready for the next backend pass."
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default Settings
