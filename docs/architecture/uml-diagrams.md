# Campus Event Navigation — UML Diagrams

> **How to view:** Install the [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) VS Code extension, open this file, and press `Ctrl+Shift+V`. Diagrams also render automatically on GitHub.

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Browser["Browser (React SPA — Vite)"]
        main["main.jsx\nHashRouter + EventProvider"]
        App["App.jsx\nAuth Guard + Router"]
        Layout["MainLayout\nNav + Notification Inbox + DM Engine"]

        subgraph Pages["Pages"]
            Discover["Discover"]
            Explore["Explore"]
            MyEvents["MyEvents"]
            Profile["Profile"]
            PublicProfile["PublicProfile"]
            Messages["Messages"]
            CreateEvent["CreateEvent"]
            Login["Login"]
            SignUp["SignUp"]
        end

        subgraph Components["Components"]
            EventCard["EventCard"]
            MyEventCard["MyEventCard"]
            ExploreEventTile["ExploreEventTile"]
            ExploreEventModal["ExploreEventModal"]
        end

        EventContext["EventContext\n(Global State)"]
        ThemeJS["theme.js"]
        LS["localStorage\nuser · profileImage · themeMode"]
    end

    subgraph Supabase["Supabase (Cloud Backend)"]
        Auth["Auth\nemail/password sessions"]
        DB[("PostgreSQL\nevents · rsvps · profiles\nfollows · messages")]
        Storage["Storage\nevent-flyers · profile-images"]
        Realtime["Realtime\nmessages channel"]
    end

    main --> App
    App --> Layout
    Layout --> Discover
    Layout --> Explore
    Layout --> MyEvents
    Layout --> Profile
    Layout --> PublicProfile
    Layout --> Messages
    Layout --> CreateEvent
    App --> Login
    App --> SignUp

    Discover --> EventCard
    MyEvents --> MyEventCard
    Explore --> ExploreEventTile
    Explore --> ExploreEventModal

    Pages --> EventContext
    Components --> EventContext

    EventContext --> DB
    App --> Auth
    Login --> Auth
    SignUp --> Auth
    CreateEvent --> Storage
    Profile --> Storage
    Profile --> LS
    App --> LS
    App --> ThemeJS
    Layout --> Realtime
```

---

## 2. Component Hierarchy

```mermaid
graph TD
    main["main.jsx\nHashRouter"] --> EventProvider["EventProvider"]
    EventProvider --> AppRoot["App\nsession state · auth guard"]

    AppRoot -->|public| Login
    AppRoot -->|public| SignUp
    AppRoot -->|public| Logout

    AppRoot -->|protected| MainLayout["MainLayout\nnav + inbox + DM engine"]

    MainLayout --> Discover
    MainLayout --> Explore
    MainLayout --> MyEvents
    MainLayout --> Profile
    MainLayout --> PublicProfile
    MainLayout --> Messages
    MainLayout --> CreateEvent

    Discover --> EventCard
    MyEvents --> MyEventCard
    MyEvents --> CalendarView["Calendar View"]

    Explore --> ExploreEventTile
    Explore --> ExploreEventModal

    Profile --> EditProfile["EditProfile Modal"]
    Profile --> CropModal["CropModal\nreact-easy-crop"]
    Profile --> SettingsModal["Settings Modal"]
    Profile --> FollowersModal["Followers Modal"]
    Profile --> FollowingModal["Following Modal"]

    PublicProfile --> PubFollowersModal["Followers Modal"]
    PublicProfile --> PubFollowingModal["Following Modal"]
```

---

## 3. Database Schema (ER Diagram)

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        string email
        string encrypted_password
        timestamp created_at
    }

    PROFILES {
        uuid id PK
        string name
        string username
        string bio
        string avatar_url
        timestamp updated_at
    }

    EVENTS {
        uuid id PK
        string title
        string description
        string location
        string location_address
        string date
        date event_date
        string start_time
        string price
        int capacity
        string organizer
        string dress_code
        string image
        string tags
        uuid created_by FK
        string creator_username
        int going_count
        timestamp created_at
        timestamp updated_at
    }

    RSVPS {
        uuid id PK
        uuid user_id FK
        uuid event_id FK
        timestamp created_at
    }

    FOLLOWS {
        uuid id PK
        uuid follower_id FK
        uuid following_id FK
        timestamp created_at
    }

    MESSAGES {
        uuid id PK
        uuid sender_id FK
        uuid recipient_id FK
        string content
        boolean read
        timestamp created_at
    }

    AUTH_USERS ||--o| PROFILES : "extends"
    AUTH_USERS ||--o{ EVENTS : "creates"
    AUTH_USERS ||--o{ RSVPS : "submits"
    AUTH_USERS ||--o{ FOLLOWS : "follows"
    AUTH_USERS ||--o{ MESSAGES : "sends"
    EVENTS ||--o{ RSVPS : "receives"
```

---

## 4. Key Data Flows (Sequence Diagram)

```mermaid
sequenceDiagram
    participant User
    participant App
    participant SupabaseAuth
    participant EventContext
    participant SupabaseDB
    participant SupabaseRealtime

    User->>App: Opens app
    App->>SupabaseAuth: getSession()
    SupabaseAuth-->>App: session | null
    App->>App: redirect to /discover or /auth/login

    Note over EventContext,SupabaseDB: App mount
    EventContext->>SupabaseDB: SELECT events, rsvps, follows
    SupabaseDB-->>EventContext: data
    EventContext->>EventContext: normalize and set state

    User->>Discover: Swipes right
    Discover->>EventContext: addEvent(event)
    EventContext->>SupabaseDB: INSERT INTO rsvps
    EventContext->>EventContext: update savedEvents and goingCount

    User->>Messages: Opens DM thread
    App->>SupabaseDB: SELECT messages for thread
    SupabaseDB-->>App: messages[]
    App->>SupabaseRealtime: subscribe to new messages
    User->>Messages: Sends message
    App->>SupabaseDB: INSERT INTO messages
    SupabaseRealtime-->>App: broadcast to recipient

    User->>Profile: Saves profile and photo
    Profile->>SupabaseStorage: upload avatar
    SupabaseStorage-->>Profile: public URL
    Profile->>SupabaseDB: UPSERT profiles with avatar_url

    User->>Explore: Clicks Follow
    Explore->>EventContext: follow(userId)
    EventContext->>SupabaseDB: INSERT INTO follows
    EventContext->>EventContext: update followingList
```

---

## 5. Class Diagram

```mermaid
classDiagram
    class EventContext {
        +User currentUser
        +User[] followingList
        +User[] followersList
        +User[] mutualUsers
        +Event[] savedEvents
        +Event[] allEvents
        +addEvent(event, attendeeUser)
        +createEvent(event)
        +cancelRSVP(eventId)
        +deleteEvent(eventId)
        +follow(targetUserId)
        +unfollow(targetUserId)
    }

    class App {
        -Session session
        -bool isInitializing
        +render()
    }

    class MainLayout {
        -bool isInboxOpen
        -string notificationFilter
        -string activeDmThreadId
        -string dmDraftMessage
        -Thread[] dmThreads
        -Map dmMessagesByThread
        -Set unreadDmThreadIds
        +openDmThread(thread)
        +closeDmThread()
        +handleSendDmMessage(event)
        +openInbox()
        +closeInbox()
    }

    class Discover {
        -int currentIndex
        -string swipeDirection
        -string[] dismissedEventIds
        -bool isActionLocked
        +handleAccept()
        +handleReject()
    }

    class Explore {
        -string searchQuery
        -Event expandedEvent
        -Map followOverrides
        -ProfileResult[] remoteProfileResults
        +handleFollowToggle(person)
        +handleEventAction(event)
        +handleOpenPerson(person)
    }

    class Messages {
        +render()
    }

    class Profile {
        -string name
        -string username
        -string bio
        -string profileImage
        -string themeMode
        -bool isEditProfileOpen
        -bool isSettingsOpen
        +handleSaveProfile()
        +handleApplyCrop()
        +follow(id)
        +unfollow(id)
    }

    class PublicProfile {
        -ProfileData profile
        -bool isFollowing
        -User[] followers
        -User[] following
        -int followerCount
        -int followingCount
        +handleFollow()
        +handleUnfollow()
        +handleMessage()
    }

    class CreateEvent {
        -string title
        -string description
        -string date
        -string locationName
        -File flyerFile
        -bool isUploading
        -string[] tags
        +handlePublish()
        +uploadFlyerToSupabase()
    }

    class EventCard {
        -bool flipped
        -bool isMutualsOpen
    }

    class ExploreEventTile {
        +Event event
        +onOpen(event)
    }

    class ExploreEventModal {
        +Event event
        +onClose()
        +onRsvp()
    }

    class Event {
        +string id
        +string title
        +string description
        +string location
        +string locationAddress
        +string date
        +string time
        +string price
        +string organizer
        +string dressCode
        +string image
        +string[] tags
        +int capacity
        +int goingCount
    }

    class User {
        +string id
        +string email
        +string name
        +string username
        +string image
    }

    App --> MainLayout
    App --> EventContext
    MainLayout --> Discover
    MainLayout --> Explore
    MainLayout --> MyEvents
    MainLayout --> Profile
    MainLayout --> PublicProfile
    MainLayout --> Messages
    MainLayout --> CreateEvent
    Discover --> EventCard
    Explore --> ExploreEventTile
    Explore --> ExploreEventModal
    EventContext "1" --> "*" Event
    EventContext "1" --> "*" User
```
