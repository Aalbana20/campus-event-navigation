import React from "react"
import "./CreateEvent.css"
import { useEvents } from "./context/EventContext"

function CreateEvent() {
  const { createEvent } = useEvents()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [location, setLocation] = useState("")
  const [eventType, setEventType] = useState("Free")
  const [capacity, setCapacity] = useState("")
  const [flyerPreview, setFlyerPreview] = useState("")

  const handlePublish = () => {
    const newEvent = {
      id: Date.now(),
      title: title || "New Campus Event",
      location: location || "UMES Campus",
      date: date ? new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "April 30",
      price: eventType === "Paid" ? "$10" : "Free",
      rsvp: "0 Going",
      image:
        flyerPreview ||
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
      description,
      time,
      capacity,
    }

    createEvent(newEvent)
    alert("Event published! Check Discover.")
  }

  const handleFlyerUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const imageUrl = URL.createObjectURL(file)
      setFlyerPreview(imageUrl)
    }
  }

  return (
    <div className="create-page">
      <div className="create-header">
        <p>Create and customize your event</p>
        <h1>Create Event</h1>
      </div>

      <div className="create-layout">
        <div className="create-form-card">
          <div className="form-group">
            <label>Event Title</label>
            <input
              type="text"
              placeholder="Spring Campus Festival"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="Describe your event..."
              rows="5"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              placeholder="Student Center Ballroom"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Event Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option>Free</option>
                <option>Paid</option>
              </select>
            </div>

            <div className="form-group">
              <label>Capacity</label>
              <input
                type="number"
                placeholder="100"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>

          <button className="publish-btn" onClick={handlePublish}>
            Publish Event
          </button>
        </div>

        <div className="flyer-card">
          <div className="flyer-preview">
            {flyerPreview ? (
              <img src={flyerPreview} alt="Flyer preview" className="flyer-image" />
            ) : (
              <p>Flyer Preview</p>
            )}
          </div>

          <div className="flyer-actions">
            <label className="upload-btn">
              Upload Flyer 📤
              <input
                type="file"
                accept="image/*"
                onChange={handleFlyerUpload}
                style={{ display: "none" }}
              />
            </label>

            <button className="ai-btn">Generate with AI ✨</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateEvent