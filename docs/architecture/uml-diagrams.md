# Campus Event Navigation — UML Diagrams

> **How to view:** Install the [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) VS Code extension, open this file, and press `Ctrl+Shift+V`.

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Browser["Browser (React SPA — Vite)"]
        main["main.jsx\nHashRouter + EventProvider"]
        App["App.jsx\nAuth Guard + Router"]
        Layout["MainLayout\nNav + Notification Inbox"]

        subgraph Pages["Pages"]
            Discover["Discover"]
            MyEvents["MyEvents"]
            Profile["Profile"]
            CreateEvent["CreateEvent"]
            Login["Login"]
            SignUp["SignUp"]
        end

        subgraph Components["Reusable Components"]
            EventCard["EventCard"]
            MyEventCard["MyEventCard"]
        end

        EventContext["EventContext\n(Global State)"]
        LS["localStorage\nuser · profileImage · themeMode"]
    end

    subgraph Supabase["Supabase (Cloud Backend)"]
        Auth["Auth\nemail/password sessions"]
        DB[("PostgreSQL\nevents · rsvps · profiles")]
        Storage["Storage\nevent-flyers bucket"]
    end

    main --> App
    App --> Layout
    Layout --> Discover
    Layout --> MyEvents
    Layout --> Profile
    Layout --> CreateEvent
    App --> Login
    App --> SignUp

    Discover --> EventCard
    MyEvents --> MyEventCard

    Pages --> EventContext
    Components --> EventContext

    EventContext --> DB
    App --> Auth
    Login --> Auth
    SignUp --> Auth
    CreateEvent --> Storage
    Profile --> LS
    App --> LS
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

    AppRoot -->|protected| MainLayout["MainLayout\ntop nav + notification inbox"]

    MainLayout --> Discover
    MainLayout --> MyEvents
    MainLayout --> Profile
    MainLayout --> CreateEvent

    Discover --> EventCard
    MyEvents --> MyEventCard
    MyEvents --> CalendarView["Calendar View"]

    Profile --> EditProfile["EditProfile Modal"]
    Profile --> CropModal["CropModal\nreact-easy-crop"]
    Profile --> SettingsModal["Settings Modal"]
    Profile --> FollowersModal["Followers Modal"]
    Profile --> FollowingModal["Following Modal"]
    Profile --> CreatedEventsModal["Created Events Modal"]
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

    AUTH_USERS ||--o| PROFILES : "extends"
    AUTH_USERS ||--o{ EVENTS : "creates"
    AUTH_USERS ||--o{ RSVPS : "submits"
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

    User->>App: Opens app
    App->>SupabaseAuth: getSession()
    SupabaseAuth-->>App: session | null
    App->>App: redirect → /discover or /auth/login

    Note over EventContext,SupabaseDB: App mount — load data
    EventContext->>SupabaseDB: SELECT * FROM events ORDER BY created_at DESC
    SupabaseDB-->>EventContext: events[]
    EventContext->>SupabaseDB: SELECT * FROM rsvps WHERE user_id = currentUser.id
    SupabaseDB-->>EventContext: rsvps[]
    EventContext->>EventContext: savedEvents = events filtered by rsvps

    User->>Discover: Swipes right on event
    Discover->>EventContext: addEvent(event)
    EventContext->>SupabaseDB: INSERT INTO rsvps (user_id, event_id)
    EventContext->>EventContext: savedEvents.push(event)
    EventContext->>EventContext: allEvents[i].goingCount++

    User->>CreateEvent: Fills form + uploads flyer
    CreateEvent->>SupabaseStorage: upload flyer image
    SupabaseStorage-->>CreateEvent: public image URL
    CreateEvent->>SupabaseDB: INSERT INTO events (...)
    CreateEvent->>EventContext: createEvent(newEvent)
    EventContext->>EventContext: allEvents.unshift(newEvent)

    User->>Profile: Saves profile edits
    Profile->>SupabaseDB: UPSERT INTO profiles (id, name, username, bio)
    Profile->>localStorage: update cached user object
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
    }

    class App {
        -Session session
        -bool isInitializing
        +render()
    }

    class MainLayout {
        -bool isInboxOpen
        -string activeInboxTab
        -string notificationFilter
        -Notification[] notifications
        +render()
    }

    class Discover {
        -int currentIndex
        -string swipeDirection
        -bool cardEntering
        +handleAccept()
        +handleReject()
        +showNextEvent()
    }

    class MyEvents {
        -string viewMode
        -Date currentMonth
        -Event selectedCalendarEvent
        +goToPrevMonth()
        +goToNextMonth()
        +getEventForDay(day)
        +parseEventDate(str)
    }

    class Profile {
        -string name
        -string username
        -string bio
        -string profileImage
        -string activePanel
        -bool isEditProfileOpen
        -bool isSettingsOpen
        -string themeMode
        +handleSaveProfile()
        +handleImageCrop()
    }

    class CreateEvent {
        -string title
        -string description
        -string date
        -string time
        -string locationName
        -string locationAddress
        -int capacity
        -File flyerFile
        -bool isUploading
        -string[] tags
        +handlePublish()
        +uploadFlyerToSupabase()
        +handleAddTag()
        +handleRemoveTag()
    }

    class EventCard {
        -bool flipped
        -bool isMutualsOpen
        +render()
    }

    class MyEventCard {
        -bool flipped
        +render()
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
        +User[] attendees
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
    MainLayout --> MyEvents
    MainLayout --> Profile
    MainLayout --> CreateEvent
    Discover --> EventCard
    MyEvents --> MyEventCard
    Discover --> EventContext
    MyEvents --> EventContext
    Profile --> EventContext
    CreateEvent --> EventContext
    EventContext "1" --> "*" Event
    EventContext "1" --> "*" User
```

