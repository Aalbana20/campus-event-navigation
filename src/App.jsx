import React from "react"
import "./App.css"
import { Routes, Route, Link, Navigate, Outlet } from "react-router-dom"
import Discover from "./pages/Discover"
import MyEvents from "./pages/MyEvents"
import Profile from "./pages/Profile"
import CreateEvent from "./CreateEvent"
import SignUp from "./pages/SignUp"
import Login from "./pages/Login"
import Logout from "./pages/Logout"

function MainLayout() {
  return (
    <>
      <nav className="topbar">
        <div className="topbar-left">
          <Link className="topbar-item" to="/">Discover</Link>
          <Link className="topbar-item" to="/events">My Events</Link>
          <Link className="topbar-item" to="/create">Create Event</Link>
          <Link className="topbar-item" to="/profile">Profile</Link>
        </div>

        <div className="topbar-right">
          <button className="gear-btn" type="button" aria-label="Settings">
            ⚙️
          </button>
          <Link className="logout-link" to="/auth/logout">
            Logout
          </Link>
        </div>
      </nav>
      <Outlet />
    </>
  )
}

function AuthLayout() {
  return <Outlet />
}

function App() {
  return (
    <div className="app">
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Discover />} />
          <Route path="/events" element={<MyEvents />} />
          <Route path="/create" element={<CreateEvent />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<Navigate to="login" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="logout" element={<Logout />} />
        </Route>

        <Route path="/login" element={<Navigate to="/auth/login" replace />} />
        <Route path="/signup" element={<Navigate to="/auth/signup" replace />} />
        <Route path="/logout" element={<Navigate to="/auth/logout" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App