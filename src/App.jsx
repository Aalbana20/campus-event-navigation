import React from "react"
import "./App.css"
import { Routes, Route, Link, Navigate, Outlet } from "react-router-dom"
import Discover from "./pages/Discover"
import MyEvents from "./pages/MyEvents"
import MapPage from "./pages/MapPage"
import Profile from "./pages/Profile"
import CreateEvent from "./CreateEvent"
import SignUp from "./pages/SignUp"
import Login from "./pages/Login"
import Logout from "./pages/Logout"

function MainLayout() {
  return (
    <>
      <nav className="navbar">
        <Link className="nav-item" to="/">🔎 Discover</Link>
        <Link className="nav-item" to="/events">📅 My Events</Link>
        <Link className="nav-item" to="/map">🌎 Map</Link>
        <Link className="nav-item" to="/create">➕ Create Event</Link>
        <Link className="nav-item" to="/profile">👤 Profile</Link>
        <Link className="nav-item" to="/auth/logout">Logout</Link>
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
          <Route path="/map" element={<MapPage />} />
          <Route path="/create" element={<CreateEvent />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<Navigate to="login" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="logout" element={<Logout />} />
          <Route path="*" element={<Navigate to="login" replace />} />
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
