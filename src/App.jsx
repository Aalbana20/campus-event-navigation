import "./App.css"
import { Routes, Route, Link } from "react-router-dom"
import Discover from "./pages/Discover"
import MyEvents from "./pages/MyEvents"
import MapPage from "./pages/MapPage"
import Profile from "./pages/Profile"
import CreateEvent from "./CreateEvent"
import SignUp from "./pages/SignUp"

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <Link className="nav-item" to="/">🔎 Discover</Link>
        <Link className="nav-item" to="/events">📅 My Events</Link>
        <Link className="nav-item" to="/map">🌎 Map</Link>
        <Link className="nav-item" to="/create">➕ Create Event</Link>
        <Link className="nav-item" to="/profile">👤 Profile</Link>
        <Link className="nav-item" to="/signup">Sign Up</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Discover />} />
        <Route path="/events" element={<MyEvents />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/create" element={<CreateEvent />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/signup" element={<SignUp />} />
      </Routes>
    </div>
  )
}

export default App