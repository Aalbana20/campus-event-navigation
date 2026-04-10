import React, { useEffect, useMemo, useRef, useState } from "react"
import "./CreateEvent.css"
import { useEvents } from "./context/EventContext"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"
import { supabase } from "./supabaseClient"

const ADDRESS_AUTOCOMPLETE_PROVIDER = "google-places-new"
const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
const GOOGLE_PLACES_REGION = (import.meta.env.VITE_GOOGLE_PLACES_REGION || "us").toLowerCase()

const BASE_TAG_SUGGESTIONS = ["campus", "community", "students"]

// Future AI suggestions can plug into the same shape as these rule-based options.
const TAG_SUGGESTION_RULES = [
  {
    id: "sports-basketball",
    label: "Basketball event",
    keywords: ["basketball", "hoops", "scrimmage", "halftime", "court"],
    tags: ["sports", "game", "basketball"],
  },
  {
    id: "sports-football",
    label: "Football event",
    keywords: ["football", "tailgate", "touchdown", "stadium"],
    tags: ["sports", "game", "football"],
  },
  {
    id: "music",
    label: "Live music",
    keywords: ["concert", "dj", "band", "showcase", "set", "live music"],
    tags: ["music", "concert", "live"],
  },
  {
    id: "party",
    label: "Social night",
    keywords: ["party", "afterparty", "kickback", "late night", "nightlife"],
    tags: ["party", "social", "nightlife"],
  },
  {
    id: "film",
    label: "Movie event",
    keywords: ["movie", "film", "screening", "cinema"],
    tags: ["film", "movie", "screening"],
  },
  {
    id: "career",
    label: "Career networking",
    keywords: ["career", "networking", "resume", "internship", "professional", "mixer"],
    tags: ["networking", "career", "mixer"],
  },
  {
    id: "workshop",
    label: "Workshop or panel",
    keywords: ["workshop", "panel", "seminar", "training", "class"],
    tags: ["workshop", "learning", "campus"],
  },
  {
    id: "food",
    label: "Food gathering",
    keywords: ["brunch", "food", "cookout", "bbq", "dinner", "taste"],
    tags: ["food", "social", "community"],
  },
  {
    id: "arts",
    label: "Creative event",
    keywords: ["art", "gallery", "fashion", "poetry", "open mic", "creative"],
    tags: ["arts", "creative", "showcase"],
  },
]

const normalizeTag = (rawTag) =>
  String(rawTag || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")

const dedupeTagOptions = (items) => {
  const seen = new Set()

  return items.reduce((collection, item) => {
    const cleanTag = normalizeTag(item.tag)

    if (!cleanTag || seen.has(cleanTag)) return collection

    seen.add(cleanTag)
    collection.push({
      ...item,
      tag: cleanTag,
    })

    return collection
  }, [])
}

const buildSuggestedTagOptions = (draft) => {
  const haystack = [
    draft.title,
    draft.description,
    draft.locationName,
    draft.locationAddress,
    draft.organizer,
    draft.dressCode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const baseSuggestions = BASE_TAG_SUGGESTIONS.map((tag) => ({
    tag,
    source: "base",
    reason: "Common campus event tag",
  }))

  const matchedRuleSuggestions = TAG_SUGGESTION_RULES.flatMap((rule) =>
    rule.keywords.some((keyword) => haystack.includes(keyword))
      ? rule.tags.map((tag) => ({
          tag,
          source: rule.id,
          reason: rule.label,
        }))
      : []
  )

  const contextualSuggestions = [
    {
      tag: draft.eventType === "Paid" ? "ticketed" : "free",
      source: "pricing",
      reason: "Event type",
    },
    ...(draft.isPrivate
      ? [
          {
            tag: "private",
            source: "privacy",
            reason: "Private event",
          },
          {
            tag: "invite-only",
            source: "privacy",
            reason: "Private event",
          },
        ]
      : [
          {
            tag: "open",
            source: "privacy",
            reason: "Public event",
          },
        ]),
    ...(draft.locationName || draft.locationAddress
      ? [
          {
            tag: "local",
            source: "location",
            reason: "Location added",
          },
        ]
      : []),
  ]

  return dedupeTagOptions([
    ...baseSuggestions,
    ...matchedRuleSuggestions,
    ...contextualSuggestions,
  ])
}

const createPlacesSessionToken = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const buildAddressDraft = (locationName = "", locationAddress = "", overrides = {}) => ({
  provider: ADDRESS_AUTOCOMPLETE_PROVIDER,
  status: overrides.status || "manual-entry",
  displayName: overrides.displayName ?? locationName ?? "",
  input: overrides.input ?? locationAddress ?? "",
  formattedAddress: overrides.formattedAddress ?? locationAddress ?? locationName ?? "",
  placeId: overrides.placeId ?? "",
  placeName: overrides.placeName ?? "",
  sessionToken: overrides.sessionToken ?? null,
  coordinates: overrides.coordinates ?? null,
})

const mapAutocompleteSuggestions = (responseData) =>
  (responseData?.suggestions || [])
    .map((suggestion, index) => {
      const placePrediction = suggestion.placePrediction

      if (!placePrediction) return null

      const placeId =
        placePrediction.placeId ||
        placePrediction.place?.replace(/^places\//, "") ||
        ""

      const mainText =
        placePrediction.structuredFormat?.mainText?.text ||
        placePrediction.text?.text ||
        ""

      const secondaryText =
        placePrediction.structuredFormat?.secondaryText?.text ||
        ""

      const fullText =
        placePrediction.text?.text ||
        [mainText, secondaryText].filter(Boolean).join(", ")

      return {
        id: placeId || `address-suggestion-${index}`,
        placeId,
        placeName: placePrediction.place || "",
        mainText,
        secondaryText,
        fullText,
      }
    })
    .filter(Boolean)

const fetchPlaceSuggestions = async ({ input, sessionToken, signal }) => {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
    },
    body: JSON.stringify({
      input,
      sessionToken,
      regionCode: GOOGLE_PLACES_REGION,
      languageCode: "en",
    }),
  })

  if (!response.ok) {
    throw new Error("Unable to load address suggestions.")
  }

  return response.json()
}

const fetchPlaceDetails = async ({ placeId, signal }) => {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    method: "GET",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
    },
  })

  if (!response.ok) {
    throw new Error("Unable to load place details.")
  }

  return response.json()
}

const getSpeechRecognitionConstructor = () => {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function CreateEvent({ embedded = false }) {
  const { createEvent } = useEvents()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [locationName, setLocationName] = useState("")
  const [locationAddress, setLocationAddress] = useState("")
  const [eventType, setEventType] = useState("Free")
  const [isPrivate, setIsPrivate] = useState(false)
  const [capacity, setCapacity] = useState("")
  const [flyerPreview, setFlyerPreview] = useState("")
  const [flyerFile, setFlyerFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState([])
  const [organizer, setOrganizer] = useState("")
  const [dressCode, setDressCode] = useState("")
  const [voiceFeedback, setVoiceFeedback] = useState("")
  const [listeningField, setListeningField] = useState("")
  const [addressMeta, setAddressMeta] = useState(() => buildAddressDraft())
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [isAddressLoading, setIsAddressLoading] = useState(false)
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false)
  const [placesSessionToken, setPlacesSessionToken] = useState(createPlacesSessionToken)

  const recognitionRef = useRef(null)
  const addressBlurTimeoutRef = useRef(null)

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const creatorUsername = currentUser.username || "itzmesuccess1"
  const creatorName = currentUser.name || "Campus Organization"
  const supportsVoiceInput = Boolean(getSpeechRecognitionConstructor())
  const isGooglePlacesConfigured = Boolean(GOOGLE_PLACES_API_KEY)

  const suggestedTagOptions = useMemo(
    () =>
      buildSuggestedTagOptions({
        title,
        description,
        locationName,
        locationAddress,
        organizer,
        dressCode,
        eventType,
        isPrivate,
      }),
    [description, dressCode, eventType, isPrivate, locationAddress, locationName, organizer, title]
  )

  useEffect(() => {
    return () => {
      if (flyerPreview && flyerPreview.startsWith("blob:")) {
        URL.revokeObjectURL(flyerPreview)
      }
    }
  }, [flyerPreview])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (addressBlurTimeoutRef.current) {
        window.clearTimeout(addressBlurTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!voiceFeedback) return undefined

    const timeoutId = window.setTimeout(() => {
      setVoiceFeedback("")
    }, 2600)

    return () => window.clearTimeout(timeoutId)
  }, [voiceFeedback])

  useEffect(() => {
    const trimmedAddress = locationAddress.trim()

    if (
      !isGooglePlacesConfigured ||
      trimmedAddress.length < 3 ||
      (addressMeta.placeId &&
        addressMeta.formattedAddress === trimmedAddress &&
        addressMeta.status === "selected-google-place")
    ) {
      setAddressSuggestions([])
      setIsAddressLoading(false)
      return undefined
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsAddressLoading(true)

        const responseData = await fetchPlaceSuggestions({
          input: trimmedAddress,
          sessionToken: placesSessionToken,
          signal: controller.signal,
        })

        const nextSuggestions = mapAutocompleteSuggestions(responseData)
        setAddressSuggestions(nextSuggestions)
        setIsAddressDropdownOpen(nextSuggestions.length > 0)
      } catch {
        if (controller.signal.aborted) return
        setAddressSuggestions([])
        setIsAddressDropdownOpen(false)
      } finally {
        if (!controller.signal.aborted) {
          setIsAddressLoading(false)
        }
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [
    addressMeta.formattedAddress,
    addressMeta.placeId,
    addressMeta.status,
    isGooglePlacesConfigured,
    locationAddress,
    placesSessionToken,
  ])

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

  const buildTimeLabel = (startTime, finishTime) => {
    const formattedStart = formatTimeFromInput(startTime)
    const formattedEnd = formatTimeFromInput(finishTime)

    if (formattedStart !== "TBA" && formattedEnd !== "TBA") {
      return `${formattedStart} - ${formattedEnd}`
    }

    if (formattedStart !== "TBA") return formattedStart
    if (formattedEnd !== "TBA") return formattedEnd
    return "TBA"
  }

  const uploadFlyerToSupabase = async (file) => {
    if (!file) return ""

    const safeFileName = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`
    const filePath = `flyers/${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from("event-flyers")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data: publicUrlData } = supabase.storage
      .from("event-flyers")
      .getPublicUrl(filePath)

    return publicUrlData.publicUrl
  }

  const appendVoiceTranscriptToField = (fieldName, transcript) => {
    const mergeValue = (currentValue, nextTranscript) =>
      currentValue.trim() ? `${currentValue.trim()} ${nextTranscript}` : nextTranscript

    switch (fieldName) {
      case "title":
        setTitle((prev) => mergeValue(prev, transcript))
        return
      case "description":
        setDescription((prev) => mergeValue(prev, transcript))
        return
      case "locationName":
        setLocationName((prev) => mergeValue(prev, transcript))
        setAddressMeta((prev) =>
          buildAddressDraft(mergeValue(locationName, transcript), locationAddress, {
            ...prev,
            displayName: mergeValue(prev.displayName || locationName, transcript),
          })
        )
        return
      case "locationAddress":
        setLocationAddress((prev) => {
          const merged = mergeValue(prev, transcript)
          setAddressMeta((current) =>
            buildAddressDraft(locationName, merged, {
              ...current,
              status: "typing",
              input: merged,
              formattedAddress: merged,
              placeId: "",
              placeName: "",
              coordinates: null,
              sessionToken: placesSessionToken,
            })
          )
          return merged
        })
        return
      case "organizer":
        setOrganizer((prev) => mergeValue(prev, transcript))
        return
      case "dressCode":
        setDressCode((prev) => mergeValue(prev, transcript))
        return
      default:
    }
  }

  const handleVoiceInput = (fieldName) => {
    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor()

    if (!SpeechRecognitionConstructor) {
      setVoiceFeedback("Voice input is not supported in this browser yet.")
      return
    }

    if (recognitionRef.current && listeningField === fieldName) {
      recognitionRef.current.stop()
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognitionConstructor()
    recognition.lang = "en-US"
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListeningField(fieldName)
      setVoiceFeedback("Listening...")
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim()

      if (!transcript) {
        setVoiceFeedback("No voice input was captured.")
        return
      }

      appendVoiceTranscriptToField(fieldName, transcript)
      setVoiceFeedback("Voice text added.")
    }

    recognition.onerror = (event) => {
      const nextMessage =
        event.error === "not-allowed"
          ? "Microphone access was denied."
          : "Voice input had trouble capturing that."

      setVoiceFeedback(nextMessage)
      setListeningField("")
      recognitionRef.current = null
    }

    recognition.onend = () => {
      setListeningField("")
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const clearAddressBlurTimeout = () => {
    if (addressBlurTimeoutRef.current) {
      window.clearTimeout(addressBlurTimeoutRef.current)
      addressBlurTimeoutRef.current = null
    }
  }

  const handleLocationNameChange = (event) => {
    const nextValue = event.target.value
    setLocationName(nextValue)
    setAddressMeta((prev) =>
      buildAddressDraft(nextValue, locationAddress, {
        ...prev,
        displayName: nextValue || prev.displayName,
      })
    )
  }

  const handleLocationAddressChange = (event) => {
    const nextValue = event.target.value
    const isSameAsSelected = nextValue.trim() === addressMeta.formattedAddress

    setLocationAddress(nextValue)
    setAddressMeta((prev) =>
      buildAddressDraft(locationName, nextValue, {
        ...prev,
        status: nextValue ? "typing" : "manual-entry",
        input: nextValue,
        formattedAddress: nextValue,
        placeId: isSameAsSelected ? prev.placeId : "",
        placeName: isSameAsSelected ? prev.placeName : "",
        coordinates: isSameAsSelected ? prev.coordinates : null,
        sessionToken: placesSessionToken,
      })
    )

    if (isGooglePlacesConfigured && nextValue.trim().length >= 3) {
      setIsAddressDropdownOpen(true)
    } else {
      setIsAddressDropdownOpen(false)
    }
  }

  const handleAddressFocus = () => {
    clearAddressBlurTimeout()

    if (isAddressLoading || addressSuggestions.length > 0) {
      setIsAddressDropdownOpen(true)
    }
  }

  const handleAddressBlur = () => {
    clearAddressBlurTimeout()
    addressBlurTimeoutRef.current = window.setTimeout(() => {
      setIsAddressDropdownOpen(false)
    }, 120)
  }

  const handleSelectAddressSuggestion = async (suggestion) => {
    clearAddressBlurTimeout()
    setIsAddressDropdownOpen(false)
    setAddressSuggestions([])
    setIsAddressLoading(true)

    const fallbackName = locationName.trim() || suggestion.mainText || ""
    const fallbackAddress = suggestion.fullText || locationAddress

    try {
      const details = await fetchPlaceDetails({ placeId: suggestion.placeId })
      const nextLocationName = locationName.trim() || details.displayName?.text || fallbackName
      const formattedAddress = details.formattedAddress || fallbackAddress

      setLocationAddress(formattedAddress)
      if (!locationName.trim() && nextLocationName) {
        setLocationName(nextLocationName)
      }

      setAddressMeta(
        buildAddressDraft(nextLocationName, formattedAddress, {
          status: "selected-google-place",
          displayName: nextLocationName,
          input: formattedAddress,
          formattedAddress,
          placeId: details.id || suggestion.placeId,
          placeName: suggestion.placeName,
          sessionToken: placesSessionToken,
          coordinates: details.location || null,
        })
      )
    } catch {
      setLocationAddress(fallbackAddress)
      if (!locationName.trim() && fallbackName) {
        setLocationName(fallbackName)
      }

      setAddressMeta(
        buildAddressDraft(fallbackName, fallbackAddress, {
          status: "selected-suggestion",
          displayName: fallbackName,
          input: fallbackAddress,
          formattedAddress: fallbackAddress,
          placeId: suggestion.placeId,
          placeName: suggestion.placeName,
          sessionToken: placesSessionToken,
        })
      )
    } finally {
      setIsAddressLoading(false)
      setPlacesSessionToken(createPlacesSessionToken())
    }
  }

  const renderVoiceButton = (fieldName) => (
    <button
      type="button"
      className={`create-voice-icon-btn ${listeningField === fieldName ? "listening" : ""}`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        handleVoiceInput(fieldName)
      }}
      aria-pressed={listeningField === fieldName}
      aria-label={`Use voice input for ${fieldName}`}
      title={supportsVoiceInput ? "Use voice input" : "Voice input is not supported in this browser yet"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.75A2.75 2.75 0 0 1 14.75 6.5V11.5A2.75 2.75 0 0 1 9.25 11.5V6.5A2.75 2.75 0 0 1 12 3.75Z" />
        <path d="M7.5 10.75V11.5A4.5 4.5 0 0 0 16.5 11.5V10.75" />
        <path d="M12 16V20.25" />
        <path d="M9 20.25H15" />
      </svg>
    </button>
  )

  const handlePublish = async () => {
    try {
      setIsUploading(true)

      const shortLocation = locationName.trim() || addressMeta.displayName || "UMES Campus"
      const fullAddress = locationAddress.trim() || addressMeta.formattedAddress || shortLocation
      const cleanDescription = description.trim() || "No description available."
      const cleanOrganizer = organizer.trim() || creatorName || "Campus Organization"
      const cleanDressCode = dressCode.trim() || "Open"
      const normalizedTags = tags.map(normalizeTag).filter(Boolean)

      let uploadedImageUrl =
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80"

      if (flyerFile) {
        uploadedImageUrl = await uploadFlyerToSupabase(flyerFile)
      }

      const finalAddressMeta = buildAddressDraft(shortLocation, fullAddress, {
        ...addressMeta,
        displayName: shortLocation,
        input: fullAddress,
        formattedAddress: fullAddress,
      })

      const newEvent = {
        id: Date.now(),
        title: title.trim() || "New Campus Event",
        location: shortLocation,
        locationName: shortLocation,
        locationAddress: fullAddress,
        locationMeta: finalAddressMeta,
        date: formatDateFromInput(date),
        eventDate: date || "",
        startTime: time || "",
        endTime: endTime || "",
        time: buildTimeLabel(time, endTime),
        isPrivate,
        privacy: isPrivate ? "private" : "public",
        price: eventType === "Paid" ? "$10" : "Free",
        rsvp: "0 Going",
        image: uploadedImageUrl,
        description: cleanDescription,
        organizer: cleanOrganizer,
        dressCode: cleanDressCode,
        capacity,
        tags: normalizedTags,
        createdBy: currentUser.id || creatorUsername,
        creatorUsername,
        creatorName,
        creatorAvatar: sanitizeAvatarUrl(currentUser.image || currentUser.avatar, DEFAULT_AVATAR_URL),
        createdAt: new Date().toISOString(),
        attendees: [],
        goingCount: 0,
      }

      const insertPayload = {
        title: newEvent.title,
        description: newEvent.description,
        location: newEvent.location,
        location_address: newEvent.locationAddress,
        date: newEvent.date,
        event_date: newEvent.eventDate || null,
        start_time: newEvent.startTime || null,
        end_time: newEvent.endTime || null,
        price: newEvent.price,
        capacity: newEvent.capacity ? parseInt(newEvent.capacity, 10) : null,
        organizer: newEvent.organizer,
        dress_code: newEvent.dressCode,
        image: newEvent.image,
        tags: newEvent.tags,
        created_by: currentUser.id || null,
        creator_username: newEvent.creatorUsername,
        going_count: 0,
      }

      const { data: insertedRows, error } = await supabase
        .from("events")
        .insert(insertPayload)
        .select()

      if (error) {
        alert("Failed to publish event: " + error.message)
        return
      }

      const realId = insertedRows?.[0]?.id || newEvent.id
      createEvent({ ...newEvent, id: realId })

      setTitle("")
      setDescription("")
      setDate("")
      setTime("")
      setEndTime("")
      setLocationName("")
      setLocationAddress("")
      setEventType("Free")
      setIsPrivate(false)
      setCapacity("")
      setTagInput("")
      setTags([])
      setOrganizer("")
      setDressCode("")
      setFlyerPreview("")
      setFlyerFile(null)
      setListeningField("")
      setVoiceFeedback("")
      setAddressMeta(buildAddressDraft())
      setAddressSuggestions([])
      setIsAddressDropdownOpen(false)
      setIsAddressLoading(false)
      setPlacesSessionToken(createPlacesSessionToken())

      alert("Event published! Check Discover.")
    } catch (error) {
      alert("Failed to upload flyer or publish event: " + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFlyerUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (flyerPreview && flyerPreview.startsWith("blob:")) {
      URL.revokeObjectURL(flyerPreview)
    }

    setFlyerFile(file)
    setFlyerPreview(URL.createObjectURL(file))
  }

  const handleGenerateWithAI = () => {
    setVoiceFeedback("AI event drafting is coming soon.")
  }

  const handleAddTag = (rawValue = tagInput) => {
    const cleanTag = normalizeTag(rawValue)

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

  const handleSuggestedTagToggle = (tag) => {
    const cleanTag = normalizeTag(tag)

    if (!cleanTag) return

    if (tags.includes(cleanTag)) {
      handleRemoveTag(cleanTag)
      return
    }

    handleAddTag(cleanTag)
  }

  const handleTagKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      handleAddTag()
    }

    if (event.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  return (
    <div className={`create-page ${embedded ? "embedded" : ""}`}>
      {!embedded && (
        <div className="create-header">
          <p>Create and customize your event</p>
          <h1>Create Event</h1>
        </div>
      )}

      <div className={`create-layout ${embedded ? "embedded" : ""}`}>
        <div className="create-form-card">
          {voiceFeedback ? (
            <div className="create-voice-feedback">{voiceFeedback}</div>
          ) : null}

          <div className="form-group">
            <label>Event Title</label>
            <div className="create-field-shell">
              <input
                type="text"
                placeholder="Spring Campus Festival"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              {renderVoiceButton("title")}
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <div className="create-field-shell textarea-shell">
              <textarea
                placeholder="Describe your event..."
                rows="5"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              {renderVoiceButton("description")}
            </div>
          </div>

          <div className="form-row form-row--triple">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Start Time</label>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Location Name</label>
            <div className="create-field-shell">
              <input
                type="text"
                placeholder="Student Center Ballroom"
                value={locationName}
                onChange={handleLocationNameChange}
              />
              {renderVoiceButton("locationName")}
            </div>
          </div>

          <div className="form-group">
            <label>Address</label>
            <div className="create-field-shell create-address-shell">
              <input
                type="text"
                placeholder="30665 Student Services Center, Princess Anne, MD 21853"
                value={locationAddress}
                onChange={handleLocationAddressChange}
                onFocus={handleAddressFocus}
                onBlur={handleAddressBlur}
                autoComplete="street-address"
                aria-autocomplete={isGooglePlacesConfigured ? "list" : "none"}
                aria-expanded={isGooglePlacesConfigured ? isAddressDropdownOpen : false}
                data-autocomplete-provider={addressMeta.provider}
                data-autocomplete-status={addressMeta.status}
                data-place-id={addressMeta.placeId}
              />
              {renderVoiceButton("locationAddress")}

              {(isAddressDropdownOpen || isAddressLoading) && isGooglePlacesConfigured ? (
                <div className="create-address-dropdown">
                  {isAddressLoading ? (
                    <div className="create-address-dropdown-state">Loading suggestions...</div>
                  ) : addressSuggestions.length > 0 ? (
                    <>
                      {addressSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          className="create-address-suggestion-btn"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectAddressSuggestion(suggestion)}
                        >
                          <span className="create-address-suggestion-main">
                            {suggestion.mainText || suggestion.fullText}
                          </span>
                          {suggestion.secondaryText ? (
                            <span className="create-address-suggestion-secondary">
                              {suggestion.secondaryText}
                            </span>
                          ) : null}
                        </button>
                      ))}
                      <div className="create-address-powered">Powered by Google</div>
                    </>
                  ) : (
                    <div className="create-address-dropdown-state">
                      Keep typing or enter the address manually.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
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
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tags like sports, basketball, movie..."
                />
                <button
                  type="button"
                  className="create-event-add-tag-btn"
                  onClick={() => handleAddTag()}
                >
                  Add
                </button>
              </div>

              <div className="create-event-suggested-tags">
                <p className="create-event-suggested-label">Suggested tags</p>
                <div className="create-event-suggested-list">
                  {suggestedTagOptions.map((option) => {
                    const isSelected = tags.includes(option.tag)

                    return (
                      <button
                        type="button"
                        key={`${option.source}-${option.tag}`}
                        className={`create-event-suggested-chip ${isSelected ? "selected" : ""}`}
                        onClick={() => handleSuggestedTagToggle(option.tag)}
                        aria-pressed={isSelected}
                        title={option.reason}
                      >
                        #{option.tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Organizer</label>
              <div className="create-field-shell">
                <input
                  type="text"
                  placeholder="Student Activities Board"
                  value={organizer}
                  onChange={(event) => setOrganizer(event.target.value)}
                />
                {renderVoiceButton("organizer")}
              </div>
            </div>

            <div className="form-group">
              <label>Dress Code</label>
              <div className="create-field-shell">
                <input
                  type="text"
                  placeholder="Casual"
                  value={dressCode}
                  onChange={(event) => setDressCode(event.target.value)}
                />
                {renderVoiceButton("dressCode")}
              </div>
            </div>
          </div>

          <div className="form-row form-row--triple">
            <div className="form-group">
              <label>Event Type</label>
              <select
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                <option>Free</option>
                <option>Paid</option>
              </select>
            </div>

            <div className="form-group">
              <label>Visibility</label>
              <div className="create-segmented-control" role="tablist" aria-label="Event visibility">
                <button
                  type="button"
                  className={`create-segmented-option ${!isPrivate ? "active" : ""}`}
                  onClick={() => setIsPrivate(false)}
                  aria-pressed={!isPrivate}
                >
                  Public
                </button>
                <button
                  type="button"
                  className={`create-segmented-option ${isPrivate ? "active" : ""}`}
                  onClick={() => setIsPrivate(true)}
                  aria-pressed={isPrivate}
                >
                  Private
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Capacity</label>
              <input
                type="number"
                placeholder="100"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </div>
          </div>

          <button
            className="publish-btn"
            onClick={handlePublish}
            disabled={isUploading}
          >
            {isUploading ? "Publishing..." : "Publish Event"}
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
