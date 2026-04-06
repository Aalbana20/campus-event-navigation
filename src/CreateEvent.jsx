import React, { useEffect, useState } from "react"
import "./CreateEvent.css"
import { useEvents } from "./context/EventContext"

function CreateEvent() {
  const { createEvent } = useEvents()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [locationName, setLocationName] = useState("")
  const [locationAddress, setLocationAddress] = useState("")
  const [eventType, setEventType] = useState("Free")
  const [capacity, setCapacity] = useState("")
  const [flyerPreview, setFlyerPreview] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState([])
  const [organizer, setOrganizer] = useState("")
  const [dressCode, setDressCode] = useState("")

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const creatorUsername = currentUser.username || "itzmesuccess1"
  const creatorName = currentUser.name || "Campus Organization"

  useEffect(() => {
    return () => {
      if (flyerPreview.startsWith("blob:")) {
        URL.revokeObjectURL(flyerPreview)
      }
    }
  }, [flyerPreview])

  const formatDateFromInput = (rawDate) => {
    if (!rawDate) return "April 30"

    const [year, month, day] = rawDate.split("-")
    if (!year || !month || !day) return "April 30"

    const monthNames = [
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

    const monthLabel = monthNames[Number(month) - 1]
    return monthLabel ? `${monthLabel} ${Number(day)}` : "April 30"
  }

  const formatTimeFromInput = (rawTime) => {
    if (!rawTime) return "TBA"

    const [hoursString, minutes] = rawTime.split(":")
    const hours = Number(hoursString)

    if (Number.isNaN(hours) || !minutes) return "TBA"

    const suffix = hours >= 12 ? "PM" : "AM"
    const displayHour = hours % 12 || 12

    return `${displayHour}:${minutes} ${suffix}`
  }

  const handlePublish = () => {
    const shortLocation = locationName.trim() || "UMES Campus"
    const fullAddress = locationAddress.trim() || shortLocation
    const cleanDescription =
      description.trim() || "No description available."
    const cleanOrganizer =
      organizer.trim() || creatorName || "Campus Organization"
    const cleanDressCode = dressCode.trim() || "Open"

    const newEvent = {
      id: Date.now(),
      title: title.trim() || "New Campus Event",
      location: shortLocation,
      locationName: shortLocation,
      locationAddress: fullAddress,
      date: formatDateFromInput(date),
      eventDate: date || "",
      time: formatTimeFromInput(time),
      price: eventType === "Paid" ? "$10" : "Free",
      rsvp: "0 Going",
      image:
        flyerPreview ||
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
      description: cleanDescription,
      organizer: cleanOrganizer,
      dressCode: cleanDressCode,
      capacity,
      tags,
      createdBy: creatorUsername,
      creatorUsername,
      createdAt: new Date().toISOString(),
      attendees: [],
      goingCount: 0,
    }

    createEvent(newEvent)

    setTitle("")
    setDescription("")
    setDate("")
    setTime("")
    setLocationName("")
    setLocationAddress("")
    setEventType("Free")
    setCapacity("")
    setTagInput("")
    setTags([])
    setOrganizer("")
    setDressCode("")
    setFlyerPreview("")

    alert("Event published! Check Discover.")
  }

  const handleFlyerUpload = (e) => {
    const file = e.target.files[0]

    if (file) {
      if (flyerPreview.startsWith("blob:")) {
        URL.revokeObjectURL(flyerPreview)
      }

      const imageUrl = URL.createObjectURL(file)
      setFlyerPreview(imageUrl)
    }
  }

  const handleGenerateWithAI = () => {
    console.log("Generate with AI coming soon")
  }

  const handleAddTag = () => {
    const cleanTag = tagInput.trim().toLowerCase()

    if (!cleanTag) return

    if (tags.includes(cleanTag)) {
      setTagInput("")
      return
    }

    setTags((prev) => [...prev, cleanTag])
    setTagInput("")
  }

  const handleRemoveTag = (tagToRemove) => {
    setTags((prev) => prev.filter((tag) => tag !== tagToRemove))
  }

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      handleAddTag()
    }

    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
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

          <div className="form-group">
            <label>Tags</label>
            <div className="create-event-tags-input-wrap">
              <div className="create-event-tags-list">
                {tags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className="create-event-tag-chip"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove ${tag}`}
                  >
                    #{tag} <span>×</span>
                  </button>
                ))}
              </div>

              <div className="create-event-tag-entry">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tags like sports, basketball, movie..."
                />
                <button
                  type="button"
                  className="create-event-add-tag-btn"
                  onClick={handleAddTag}
                >
                  Add
                </button>
              </div>
            </div>
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
            <label>Location Name</label>
            <input
              type="text"
              placeholder="Student Center Ballroom"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              placeholder="30665 Student Services Center, Princess Anne, MD 21853"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Organizer</label>
              <input
                type="text"
                placeholder="Student Activities Board"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Dress Code</label>
              <input
                type="text"
                placeholder="Casual"
                value={dressCode}
                onChange={(e) => setDressCode(e.target.value)}
              />
            </div>
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

            <button className="ai-btn" type="button" onClick={handleGenerateWithAI}>
              Generate with AI ✨
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateEvent