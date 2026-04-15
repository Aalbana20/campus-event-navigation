import React from "react"
import ReactDOM from "react-dom/client"
import { HashRouter } from "react-router-dom"
import App from "./App.jsx"
import "./index.css"
import { EventProvider } from "./context/EventContext"
import { ToastProvider } from "./context/ToastContext"
import ToastContainer from "./components/ToastContainer"
import { initializeTheme } from "./theme"

initializeTheme()

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <EventProvider>
        <ToastProvider>
          <App />
          <ToastContainer />
        </ToastProvider>
      </EventProvider>
    </HashRouter>
  </React.StrictMode>
)
