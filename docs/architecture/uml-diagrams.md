# Campus Event Navigation — UML Diagrams

> Render these diagrams with the [Mermaid VS Code extension](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) or view on GitHub.

---

## 1. System Architecture

```mermaid
graph TB
    subgraph Browser["Browser (Client)"]
        subgraph React["React SPA (Vite)"]
            main["main.jsx\nHashRouter + EventProvider"]
            App["App.jsx\nRouter + Auth Guard"]
            Layout["MainLayout\nNav + Inbox"]
            
            subgraph Pages
                Discover["Discover.jsx"]
                MyEvents["MyEvents.jsx"]
                Profile["Profile.jsx"]
                CreateEvent["CreateEvent.jsx"]
                Login["Login.jsx"]
                SignUp["SignUp.jsx"]
            end

            subgraph Components
                EventCard["EventCard.jsx"]
                MyEventCard["MyEventCard.jsx"]
            end

            subgraph State["Global State"]
                EventContext["EventContext\nuseEvents()"]
            end
        end

        LS["localStorage\n(user, profileImage, themeMode)"]
    end

    subgraph Supabase["Supabase (Cloud)"]
        Auth["Supabase Auth\nemail/password sessions"]
        DB[("PostgreSQL\nevents · rsvps · profiles")]
        Storage["Storage\nevent-flyers bucket"]
    end

    subgraph Backend["Express Backend (Unused in prod)"]
        Express["server.js"]
        Mongo[("MongoDB")]
    end

    Pages --> EventContext
    Components --> EventContext
    EventContext --> DB
    EventContext --> Auth
    App --> Auth
    CreateEvent --> Storage
    Login --> Auth
    SignUp --> Auth
    App --> LS
    Profile --> LS
    Express --> Mongo
```

---

## 2. Component Hierarchy

```mermaid
graph TD
    main["main.jsx\nHashRouter"] --> EventProvider
    EventProvider --> AppRoot["App (root)\nsession state"]

    AppRoot -->|"public routes"| Login
    AppRoot -->|"public routes"| SignUp
    AppRoot -->|"public routes"| Logout

    AppRoot -->|"protected routes"| MainLayout["MainLayout\ntop nav + notification inbox"]

    MainLayout --> Discover
    MainLayout --> MyEvents
    MainLayout --> Profile
    MainLayout --> CreateEvent

    Discover --> EventCard
    MyEvents --> MyEventCard
    MyEvents --> Calendar["Calendar View\n(inline JSX)"]

    Profile --> EditProfileModal["EditProfile Modal"]
    Profile --> CropModal["CropModal\n(react-easy-crop)"]
    Profile --> SettingsModal["Settings Modal"]
    Profile --> FollowersModal["Followers Modal"]
    Profile --> FollowingModal["Following Modal"]
    Profile --> CreatedEventsModal["Created Events Modal"]
```

---

## 3. Data Model (ER Diagram)

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        string email
        string encrypted_password
        timestamp created_at
    }

    PROFILES {
        uuid id PK_FK
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
        string[] tags
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

## 4. State & Data Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Supabase Auth
    participant EventContext
    participant Supabase DB

    User->>App: Opens app
    App->>Supabase Auth: getSession()
    Supabase Auth-->>App: session | null
    App->>App: Redirect → /discover or /auth/login

    Note over EventContext, Supabase DB: On mount
    EventContext->>Supabase DB: SELECT * FROM events ORDER BY created_at DESC
    Supabase DB-->>EventContext: events[]
    EventContext->>Supabase DB: SELECT * FROM rsvps WHERE user_id = ?
    Supabase DB-->>EventContext: rsvps[]
    EventContext->>EventContext: savedEvents = events matching rsvps

    User->>App: Swipes right on event (Discover)
    App->>EventContext: addEvent(event, user)
    EventContext->>Supabase DB: INSERT INTO rsvps (user_id, event_id)
    EventContext->>EventContext: savedEvents.push(event)
    EventContext->>EventContext: allEvents[i].goingCount++

    User->>App: Creates new event (CreateEvent)
    App->>Supabase DB: UPLOAD flyer to storage
    Supabase DB-->>App: public image URL
    App->>Supabase DB: INSERT INTO events (...)
    App->>EventContext: createEvent(newEvent)
    EventContext->>EventContext: allEvents.unshift(newEvent)
```

---

## 5. Class Diagram (Frontend)

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
        -string eventType
        -int capacity
        -string flyerPreview
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

    class SupabaseClient {
        +auth
        +from(table)
        +storage
    }

    App --> MainLayout
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
    App --> EventContext
    EventContext --> SupabaseClient
    CreateEvent --> SupabaseClient
    App --> SupabaseClient

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

    EventContext "1" --> "*" Event : manages
    EventContext "1" --> "*" User : manages
```

---

## 6. Backend (Express — Auth Fallback)

```mermaid
classDiagram
    class Server {
        +express app
        +connectDB()
        +listen(PORT)
    }

    class AuthRoutes {
        +POST /api/auth/register
        +POST /api/auth/login
        +GET  /api/protected
    }

    class AuthController {
        +registerUser(req, res)
        +loginUser(req, res)
    }

    class AuthMiddleware {
        +protect(req, res, next)
        +verifyJWT(token)
    }

    class UserModel {
        +String name
        +String email
        +String password
        +timestamps createdAt
        +timestamps updatedAt
    }

    Server --> AuthRoutes
    AuthRoutes --> AuthController
    AuthRoutes --> AuthMiddleware
    AuthController --> UserModel
```

