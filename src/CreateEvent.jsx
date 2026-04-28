import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import "./CreateEvent.css"
import { useEvents } from "./context/EventContext"
import { DEFAULT_AVATAR_URL, sanitizeAvatarUrl } from "./profileMedia"
import { supabase } from "./supabaseClient"
import { useToast } from "./context/ToastContext"
import { applyEventImageFallback } from "./eventImages"

const MONTH_NAMES = [
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

const ADDRESS_AUTOCOMPLETE_PROVIDER = "google-places-new"
const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || ""
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
    draft.host,
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

const FLYER_CATEGORIES = [
  { id: "party", label: "Party" },
  { id: "concert", label: "Concert" },
  { id: "sports", label: "Sports" },
  { id: "movie", label: "Movie" },
  { id: "campus", label: "Campus" },
  { id: "social", label: "Social" },
]

const FLYER_LIBRARY = [
  { id: "party-1", category: "party", label: "Neon house party", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80" },
  { id: "party-2", category: "party", label: "Rooftop celebration", image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=900&q=80" },
  { id: "concert-1", category: "concert", label: "Live concert stage", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80" },
  { id: "concert-2", category: "concert", label: "DJ set crowd", image: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80" },
  { id: "sports-1", category: "sports", label: "Stadium lights", image: "https://images.unsplash.com/photo-1521417531039-75e91e12cd8d?auto=format&fit=crop&w=900&q=80" },
  { id: "sports-2", category: "sports", label: "Court game night", image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80" },
  { id: "movie-1", category: "movie", label: "Outdoor movie night", image: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&w=900&q=80" },
  { id: "movie-2", category: "movie", label: "Classic cinema", image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=900&q=80" },
  { id: "campus-1", category: "campus", label: "Campus quad", image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80" },
  { id: "campus-2", category: "campus", label: "Lecture hall", image: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=900&q=80" },
  { id: "social-1", category: "social", label: "Friends gathering", image: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=900&q=80" },
  { id: "social-2", category: "social", label: "Coffee meetup", image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80" },
]

const buildInviteLink = (eventId) => {
  if (typeof window === "undefined") return ""
  const origin = window.location.origin || ""
  const path = window.location.pathname || "/"
  return `${origin}${path}#/events/${eventId}?invite=1`
}

const FLOW_SCREENS = {
  type: { title: "What are you creating?", subtitle: "Choose the type of event you want to create." },
  flyer: { title: "Add Flyer", subtitle: "Upload a flyer for your event. We'll use it as the main image." },
  core: { title: "Event Preview", subtitle: "Adjust the basics. This is what people see first." },
  details: { title: "Event Details", subtitle: "Add the rest of the story for your guests." },
  visibility: { title: "Invite People", subtitle: "Choose who can see and RSVP to this private event." },
  review: { title: "Review & Publish", subtitle: "Make sure everything looks right before you go live." },
}

const FLOW_ORDER_PUBLIC = ["type", "flyer", "core", "details", "review"]
const FLOW_ORDER_PRIVATE = ["type", "flyer", "core", "details", "visibility", "review"]

function CreateEvent({ embedded = false, modal = false, onPublished }) {
  const { createEvent, currentUser: contextUser, followingList } = useEvents()
  const { showToast } = useToast()

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
  const [dressCode, setDressCode] = useState("")
  const [addressMeta, setAddressMeta] = useState(() => buildAddressDraft())
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [isAddressLoading, setIsAddressLoading] = useState(false)
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false)
  const [placesSessionToken, setPlacesSessionToken] = useState(createPlacesSessionToken)
  const [flyerSearchCategory, setFlyerSearchCategory] = useState("")
  const [flyerSearchQuery, setFlyerSearchQuery] = useState("")
  const [isFlyerSearchOpen, setIsFlyerSearchOpen] = useState(false)
  const [invitedUsers, setInvitedUsers] = useState([])
  const [inviteSearch, setInviteSearch] = useState("")
  const [publishedInviteLink, setPublishedInviteLink] = useState("")
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)
  const [endDate, setEndDate] = useState("")
  const [postPublishInfo, setPostPublishInfo] = useState(null)
  const [activeStepId, setActiveStepId] = useState("type")
  const navigate = useNavigate()

  const addressBlurTimeoutRef = useRef(null)

  const creatorUsername = contextUser?.username || ""
  const creatorName = contextUser?.name || contextUser?.username || "Campus User"
  const isGooglePlacesConfigured = Boolean(GOOGLE_PLACES_API_KEY)

  const suggestedTagOptions = useMemo(
    () =>
      buildSuggestedTagOptions({
        title,
        description,
        locationName,
        locationAddress,
        host: creatorName,
        dressCode,
        eventType,
        isPrivate,
      }),
    [creatorName, description, dressCode, eventType, isPrivate, locationAddress, locationName, title]
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
      if (addressBlurTimeoutRef.current) {
        window.clearTimeout(addressBlurTimeoutRef.current)
      }
    }
  }, [])

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

  const filteredFlyers = useMemo(() => {
    const normalizedQuery = flyerSearchQuery.trim().toLowerCase()
    return FLYER_LIBRARY.filter((flyer) => {
      if (flyerSearchCategory && flyer.category !== flyerSearchCategory) return false
      if (!normalizedQuery) return true
      return (
        flyer.label.toLowerCase().includes(normalizedQuery) ||
        flyer.category.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [flyerSearchCategory, flyerSearchQuery])

  const inviteSuggestions = useMemo(() => {
    const invitedIds = new Set(invitedUsers.map((user) => String(user.id || user.username)))
    const normalizedQuery = inviteSearch.trim().toLowerCase()

    return (followingList || [])
      .filter((user) => {
        const key = String(user.id || user.username)
        if (invitedIds.has(key)) return false
        if (!normalizedQuery) return true
        const haystack = `${user.name || ""} ${user.username || ""}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .slice(0, 6)
  }, [followingList, invitedUsers, inviteSearch])

  const handleSelectStockFlyer = (flyer) => {
    if (flyerPreview && flyerPreview.startsWith("blob:")) {
      URL.revokeObjectURL(flyerPreview)
    }
    setFlyerFile(null)
    setFlyerPreview(flyer.image)
  }

  const handleToggleInvitedUser = (user) => {
    const key = String(user.id || user.username)
    setInvitedUsers((current) => {
      if (current.some((existing) => String(existing.id || existing.username) === key)) {
        return current.filter((existing) => String(existing.id || existing.username) !== key)
      }
      return [...current, user]
    })
    setInviteSearch("")
  }

  const handleCopyInviteLink = async () => {
    const linkToCopy = postPublishInfo?.inviteLink || publishedInviteLink
    if (!linkToCopy) return
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(linkToCopy)
      }
      setInviteLinkCopied(true)
      window.setTimeout(() => setInviteLinkCopied(false), 1800)
    } catch {
      setInviteLinkCopied(false)
    }
  }

  const resetEventForm = () => {
    setTitle("")
    setDescription("")
    setDate("")
    setTime("")
    setEndTime("")
    setEndDate("")
    setLocationName("")
    setLocationAddress("")
    setEventType("Free")
    setIsPrivate(false)
    setCapacity("")
    setTagInput("")
    setTags([])
    setDressCode("")
    setFlyerPreview("")
    setFlyerFile(null)
    setAddressMeta(buildAddressDraft())
    setAddressSuggestions([])
    setIsAddressDropdownOpen(false)
    setIsAddressLoading(false)
    setPlacesSessionToken(createPlacesSessionToken())
    setFlyerSearchCategory("")
    setFlyerSearchQuery("")
    setIsFlyerSearchOpen(false)
    setInvitedUsers([])
    setInviteSearch("")
    setActiveStepId("type")
  }

  const dispatchPrivateInvites = async ({ invitees, invitedLink, event }) => {
    if (!invitees.length || !contextUser?.id) return

    const senderId = contextUser.id
    const messageRows = invitees
      .filter((invitee) => invitee?.id)
      .map((invitee) => ({
        sender_id: senderId,
        recipient_id: invitee.id,
        content: `You're invited to ${event.title || "a private event"} on ${event.date || ""}. ${invitedLink}`,
      }))

    if (!messageRows.length) return

    try {
      await supabase.from("messages").insert(messageRows)
    } catch (error) {
      showToast(error?.message || "Couldn't send invites. Share the link manually.", "error")
    }
  }

  const handlePublish = async () => {
    try {
      setIsUploading(true)

      const shortLocation = locationName.trim() || addressMeta.displayName || "UMES Campus"
      const fullAddress = locationAddress.trim() || addressMeta.formattedAddress || shortLocation
      const cleanDescription = description.trim() || "No description available."
      const cleanHost = creatorName || contextUser?.username || "Campus Organization"
      const cleanDressCode = dressCode.trim() || "Open"
      const normalizedTags = tags.map(normalizeTag).filter(Boolean)

      let uploadedImageUrl =
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80"

      if (flyerFile) {
        uploadedImageUrl = await uploadFlyerToSupabase(flyerFile)
      } else if (flyerPreview && !flyerPreview.startsWith("blob:")) {
        uploadedImageUrl = flyerPreview
      }

      const finalAddressMeta = buildAddressDraft(shortLocation, fullAddress, {
        ...addressMeta,
        displayName: shortLocation,
        input: fullAddress,
        formattedAddress: fullAddress,
      })
      const locationCoordinates =
        finalAddressMeta.coordinates?.latitude != null &&
        finalAddressMeta.coordinates?.longitude != null
          ? {
              latitude: finalAddressMeta.coordinates.latitude,
              longitude: finalAddressMeta.coordinates.longitude,
            }
          : finalAddressMeta.coordinates?.lat != null &&
              finalAddressMeta.coordinates?.lng != null
            ? {
                latitude: finalAddressMeta.coordinates.lat,
                longitude: finalAddressMeta.coordinates.lng,
              }
            : null

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
        imageUrls: [uploadedImageUrl],
        description: cleanDescription,
        host: cleanHost,
        organizer: cleanHost,
        dressCode: cleanDressCode,
        capacity,
        tags: normalizedTags,
        locationCoordinates,
        createdBy: contextUser?.id || creatorUsername,
        creatorUsername,
        creatorName,
        creatorAvatar: sanitizeAvatarUrl(contextUser?.image || contextUser?.avatar, DEFAULT_AVATAR_URL),
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
        organizer: newEvent.host,
        dress_code: newEvent.dressCode,
        image: newEvent.image,
        image_urls: newEvent.imageUrls,
        location_coordinates: newEvent.locationCoordinates,
        tags: newEvent.tags,
        created_by: contextUser?.id || null,
        creator_username: newEvent.creatorUsername,
        going_count: 0,
      }

      const { data: insertedRows, error } = await supabase
        .from("events")
        .insert(insertPayload)
        .select()

      if (error) {
        showToast(error.message || "Failed to publish event.", "error")
        return
      }

      const realId = insertedRows?.[0]?.id || newEvent.id
      const publishedEvent = { ...newEvent, id: realId }
      createEvent(publishedEvent)

      const inviteLink = buildInviteLink(realId)
      setPublishedInviteLink(inviteLink)

      if (isPrivate) {
        setPostPublishInfo({ event: publishedEvent, inviteLink })
        showToast("Event published! Choose how to share it.", "success")
      } else {
        resetEventForm()
        showToast("Event published! Check Discover.", "success")
        if (typeof onPublished === "function") {
          onPublished({ event: publishedEvent, inviteLink, invitedUsers: [] })
        }
      }
    } catch (error) {
      showToast(error?.message || "Failed to publish event. Please try again.", "error")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSendInvitesNow = async () => {
    if (!postPublishInfo || invitedUsers.length === 0) return
    await dispatchPrivateInvites({
      invitees: invitedUsers,
      invitedLink: postPublishInfo.inviteLink,
      event: postPublishInfo.event,
    })
    showToast(`Invites sent to ${invitedUsers.length} ${invitedUsers.length === 1 ? "person" : "people"}.`, "success")
  }

  const handleFinishPostPublish = () => {
    const finalInfo = postPublishInfo
    const finalInvitees = [...invitedUsers]
    setPostPublishInfo(null)
    resetEventForm()
    if (typeof onPublished === "function" && finalInfo) {
      onPublished({
        event: finalInfo.event,
        inviteLink: finalInfo.inviteLink,
        invitedUsers: finalInvitees,
      })
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

  const stepOrder = isPrivate ? FLOW_ORDER_PRIVATE : FLOW_ORDER_PUBLIC
  const currentStepIndex = Math.max(0, stepOrder.indexOf(activeStepId))
  const safeStepId = stepOrder[currentStepIndex] || "type"
  const currentScreen = FLOW_SCREENS[safeStepId]
  const isLastStep = safeStepId === "review"
  const isFirstStep = safeStepId === "type"

  const stepValidationError = useMemo(() => {
    if (safeStepId === "core") {
      if (!title.trim()) return "Give your event a name to continue."
      if (!date) return "Pick a start date to continue."
    }
    return ""
  }, [date, safeStepId, title])

  const handleNextStep = () => {
    if (stepValidationError) {
      showToast(stepValidationError, "error")
      return
    }
    const nextId = stepOrder[currentStepIndex + 1]
    if (nextId) setActiveStepId(nextId)
  }

  const handlePrevStep = () => {
    const prevId = stepOrder[currentStepIndex - 1]
    if (prevId) setActiveStepId(prevId)
  }

  const handlePickEventKind = (kind) => {
    if (kind === "personal") {
      navigate("/events?create=personal")
      if (typeof onPublished === "function") {
        onPublished()
      }
      return
    }
    setIsPrivate(kind === "private")
    setActiveStepId("flyer")
  }

  const formattedReviewDate = useMemo(() => {
    if (!date) return "Date TBD"
    const [year, month, day] = date.split("-")
    if (!year || !month || !day) return "Date TBD"
    return `${MONTH_NAMES[Number(month) - 1] || ""} ${Number(day)}, ${year}`.trim()
  }, [date])

  const reviewSummary = useMemo(
    () => [
      { label: "Title", value: title.trim() || "Untitled event" },
      { label: "When", value: `${formattedReviewDate} · ${buildTimeLabel(time, endTime) || "Time TBA"}` },
      {
        label: "Where",
        value: locationName.trim() || locationAddress.trim() || "Location TBD",
      },
      {
        label: "Visibility",
        value: isPrivate ? `Private · ${invitedUsers.length} invited` : "Public",
      },
      {
        label: "Type",
        value: `${eventType}${capacity ? ` · ${capacity} spots` : ""}`,
      },
    ],
    [
      capacity,
      endTime,
      eventType,
      formattedReviewDate,
      invitedUsers.length,
      isPrivate,
      locationAddress,
      locationName,
      time,
      title,
    ]
  )

  return (
    <div className={`create-page ${embedded ? "embedded" : ""} ${modal ? "modal" : ""}`}>
      {!embedded && !modal && (
        <div className="create-header">
          <p>Create and customize your event</p>
          <h1>Create Event</h1>
        </div>
      )}

      {modal && postPublishInfo ? (
        <div className="create-modal-heading">
          <span className="personal-modal-kicker">Event</span>
          <h2>Share Your Event</h2>
        </div>
      ) : null}

      {postPublishInfo ? (
        <div className="post-publish-step">
          <div className="post-publish-card">
            <div className="post-publish-preview">
              {postPublishInfo.event?.image ? (
                <img src={postPublishInfo.event.image} alt="" />
              ) : null}
              <div>
                <p className="post-publish-kicker">Private event published</p>
                <h3>{postPublishInfo.event?.title || "Your event"}</h3>
                <p className="post-publish-meta">
                  {postPublishInfo.event?.date}
                  {postPublishInfo.event?.time && postPublishInfo.event.time !== "TBA"
                    ? ` · ${postPublishInfo.event.time}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="post-publish-section">
              <p className="post-publish-section-title">Send to selected users</p>
              <p className="post-publish-help">
                They&apos;ll get an invitation card in their DMs.
              </p>

              {invitedUsers.length > 0 ? (
                <div className="flyer-invite-chips">
                  {invitedUsers.map((user) => (
                    <button
                      type="button"
                      key={String(user.id || user.username)}
                      className="flyer-invite-chip"
                      onClick={() => handleToggleInvitedUser(user)}
                      aria-label={`Remove ${user.name || user.username}`}
                    >
                      {user.name || user.username}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <input
                type="search"
                className="flyer-search-input"
                placeholder="Search people to invite"
                value={inviteSearch}
                onChange={(event) => setInviteSearch(event.target.value)}
              />

              {inviteSuggestions.length > 0 ? (
                <ul className="flyer-invite-suggestions">
                  {inviteSuggestions.map((user) => (
                    <li key={String(user.id || user.username)}>
                      <button type="button" onClick={() => handleToggleInvitedUser(user)}>
                        <img
                          src={user.image || user.avatar || DEFAULT_AVATAR_URL}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.src = DEFAULT_AVATAR_URL
                          }}
                        />
                        <span>
                          <strong>{user.name || user.username || "User"}</strong>
                          {user.username ? <em>@{user.username}</em> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <button
                type="button"
                className="post-publish-send-btn"
                onClick={handleSendInvitesNow}
                disabled={invitedUsers.length === 0}
              >
                Send invites{invitedUsers.length > 0 ? ` (${invitedUsers.length})` : ""}
              </button>
            </div>

            <div className="post-publish-divider" />

            <div className="post-publish-section">
              <p className="post-publish-section-title">Share via link</p>
              <p className="post-publish-help">
                Anyone with this link can open the event.
              </p>
              <button
                type="button"
                className="flyer-invite-link-btn"
                onClick={handleCopyInviteLink}
              >
                {inviteLinkCopied ? "Link copied" : "Copy invite link"}
              </button>
            </div>

            <button
              type="button"
              className="post-publish-done-btn"
              onClick={handleFinishPostPublish}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
      <div className={`create-flow ${embedded ? "embedded" : ""} ${modal ? "modal" : ""} step-${safeStepId}`}>
        <aside className="create-flow-preview" aria-label="Live preview">
          {safeStepId === "review" ? (
            <div className="create-flow-review-previews">
              <div className="create-flow-preview-block">
                <p className="create-flow-preview-kicker">Card preview</p>
                <article className="event-card-preview">
                  <div className="event-card-preview-image">
                    {flyerPreview ? (
                      <img
                        src={flyerPreview}
                        alt=""
                        onError={applyEventImageFallback}
                      />
                    ) : (
                      <div className="event-card-preview-image-fallback">
                        <span aria-hidden="true">🎟</span>
                      </div>
                    )}
                    <span
                      className={`event-card-preview-pill ${isPrivate ? "private" : "public"}`}
                    >
                      {isPrivate ? "Private" : "Public"}
                    </span>
                  </div>
                  <div className="event-card-preview-body">
                    <h4>{title.trim() || "Untitled event"}</h4>
                    <p>
                      {formattedReviewDate}
                      {time ? ` · ${formatTimeFromInput(time)}` : ""}
                    </p>
                    <p className="event-card-preview-meta">
                      {locationName.trim() || locationAddress.trim() || "Location TBD"}
                    </p>
                    <div className="event-card-preview-foot">
                      <span>0 going</span>
                      <span>·</span>
                      <span>{eventType}</span>
                    </div>
                  </div>
                </article>
              </div>

              <div className="create-flow-preview-block">
                <p className="create-flow-preview-kicker">Detail preview</p>
                <article className="event-detail-preview">
                  <div className="event-detail-preview-hero">
                    {flyerPreview ? (
                      <img
                        src={flyerPreview}
                        alt=""
                        onError={applyEventImageFallback}
                      />
                    ) : (
                      <div className="event-detail-preview-hero-fallback">
                        <span aria-hidden="true">🎟</span>
                      </div>
                    )}
                  </div>
                  <div className="event-detail-preview-body">
                    <h3>{title.trim() || "Untitled event"}</h3>
                    <p className="event-detail-preview-meta">
                      {formattedReviewDate}
                      {time ? ` · ${buildTimeLabel(time, endTime) || formatTimeFromInput(time)}` : ""}
                    </p>
                    <p className="event-detail-preview-meta">
                      {locationName.trim() || "Location TBD"}
                      {locationAddress.trim() ? ` · ${locationAddress.trim()}` : ""}
                    </p>
                    {description.trim() ? (
                      <p className="event-detail-preview-description">{description.trim()}</p>
                    ) : (
                      <p className="event-detail-preview-description event-detail-preview-description-placeholder">
                        Your description will appear here.
                      </p>
                    )}
                    {tags.length > 0 ? (
                      <div className="event-detail-preview-tags">
                        {tags.slice(0, 6).map((tag) => (
                          <span key={tag} className="event-detail-preview-tag">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="event-detail-preview-actions">
                      <button type="button" className="event-detail-preview-action primary">
                        RSVP
                      </button>
                      <button type="button" className="event-detail-preview-action">
                        Save
                      </button>
                      <button type="button" className="event-detail-preview-action">
                        Share
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          ) : (
            <div className="create-flow-flyer-preview" aria-label="Flyer preview">
              <div className="create-flow-flyer-frame">
                {flyerPreview ? (
                  <img
                    src={flyerPreview}
                    alt="Flyer preview"
                    className="create-flow-flyer-image"
                  />
                ) : (
                  <div className="create-flow-flyer-empty">
                    <div className="create-flow-flyer-empty-mark" aria-hidden="true">
                      <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" />
                        <circle cx="9" cy="10" r="1.4" fill="currentColor" />
                        <path d="m4.5 18 5-5 4 4 2-2 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p>Flyer preview</p>
                    <span>Pick a flyer in the next step</span>
                  </div>
                )}
                {flyerPreview && (title.trim() || date) ? (
                  <div className="create-flow-flyer-overlay">
                    {title.trim() ? <strong>{title.trim()}</strong> : null}
                    {date ? <span>{formattedReviewDate}</span> : null}
                  </div>
                ) : null}
              </div>
              <div className="create-flow-flyer-meta">
                <p className="create-flow-flyer-meta-title">
                  {isPrivate ? "Private event" : "Public event"}
                </p>
                <p className="create-flow-flyer-meta-helper">
                  This preview updates as you go through each screen.
                </p>
              </div>
            </div>
          )}
        </aside>

        <section className="create-flow-stage" aria-label={currentScreen.title}>
          <div className="create-flow-progress" aria-label="Progress">
            {stepOrder.map((id, index) => {
              const isActive = index === currentStepIndex
              const isComplete = index < currentStepIndex
              return (
                <span
                  key={id}
                  className={`create-flow-progress-segment ${isActive ? "active" : ""} ${isComplete ? "complete" : ""}`}
                  aria-hidden="true"
                />
              )
            })}
          </div>

          <div className="create-flow-stage-screen">
            <header className="create-flow-stage-header">
              <h2 className="create-flow-stage-title">{currentScreen.title}</h2>
              <p className="create-flow-stage-subtitle">{currentScreen.subtitle}</p>
            </header>

            <div className={`create-flow-stage-body screen-${safeStepId}`}>
              {safeStepId === "type" ? (
                <div className="create-flow-type-grid">
                  <button
                    type="button"
                    className="create-flow-type-card"
                    onClick={() => handlePickEventKind("public")}
                  >
                    <span className="create-flow-type-icon" aria-hidden="true">🌐</span>
                    <span className="create-flow-type-copy">
                      <strong>Public Event</strong>
                      <span>Anyone can discover and join</span>
                    </span>
                    <span className="create-flow-type-chevron" aria-hidden="true">›</span>
                  </button>
                  <button
                    type="button"
                    className="create-flow-type-card"
                    onClick={() => handlePickEventKind("private")}
                  >
                    <span className="create-flow-type-icon" aria-hidden="true">🔒</span>
                    <span className="create-flow-type-copy">
                      <strong>Private Event</strong>
                      <span>Only selected people can see it</span>
                    </span>
                    <span className="create-flow-type-chevron" aria-hidden="true">›</span>
                  </button>
                  <button
                    type="button"
                    className="create-flow-type-card"
                    onClick={() => handlePickEventKind("personal")}
                  >
                    <span className="create-flow-type-icon" aria-hidden="true">👤</span>
                    <span className="create-flow-type-copy">
                      <strong>Personal Plan</strong>
                      <span>Just for you (not shared)</span>
                    </span>
                    <span className="create-flow-type-chevron" aria-hidden="true">›</span>
                  </button>
                </div>
              ) : null}

              {safeStepId === "flyer" ? (
                <div className="create-flow-flyer-screen">
                  <div className="create-flow-flyer-actions">
                    <label className="upload-btn">
                      Upload from device
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFlyerUpload}
                        style={{ display: "none" }}
                      />
                    </label>
                    <button
                      type="button"
                      className="ai-btn"
                      onClick={() => setIsFlyerSearchOpen((prev) => !prev)}
                      aria-expanded={isFlyerSearchOpen}
                    >
                      {isFlyerSearchOpen ? "Hide flyer library" : "Browse flyer library"}
                    </button>
                  </div>
                  {isFlyerSearchOpen ? (
                    <div className="flyer-search">
                      <div className="flyer-search-categories" role="tablist" aria-label="Flyer categories">
                        <button
                          type="button"
                          className={`flyer-search-chip ${!flyerSearchCategory ? "active" : ""}`}
                          onClick={() => setFlyerSearchCategory("")}
                        >
                          All
                        </button>
                        {FLYER_CATEGORIES.map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            className={`flyer-search-chip ${flyerSearchCategory === category.id ? "active" : ""}`}
                            onClick={() => setFlyerSearchCategory(category.id)}
                          >
                            {category.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="search"
                        className="flyer-search-input"
                        placeholder="Search flyers"
                        value={flyerSearchQuery}
                        onChange={(event) => setFlyerSearchQuery(event.target.value)}
                      />
                      <div className="flyer-search-grid">
                        {filteredFlyers.length > 0 ? (
                          filteredFlyers.map((flyer) => (
                            <button
                              key={flyer.id}
                              type="button"
                              className={`flyer-search-tile ${flyerPreview === flyer.image ? "selected" : ""}`}
                              onClick={() => handleSelectStockFlyer(flyer)}
                              title={flyer.label}
                            >
                              <img src={flyer.image} alt={flyer.label} />
                            </button>
                          ))
                        ) : (
                          <p className="flyer-search-empty">No flyers match that filter.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <p className="create-flow-flyer-tip">
                    Tip: a strong flyer is the easiest way to make people stop and tap.
                  </p>
                </div>
              ) : null}

              {safeStepId === "core" ? (
                <div className="create-flow-screen-fields">
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      placeholder="Spring Kickoff Party"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      value={date}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </div>

                  <div className="form-row">
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
                    <label>End Date (optional)</label>
                    <input
                      type="date"
                      value={endDate || ""}
                      min={date || new Date().toISOString().split("T")[0]}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              {safeStepId === "details" ? (
                <div className="create-flow-screen-fields">
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      placeholder="Describe the vibe, audience, and what people should expect."
                      rows="5"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
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
                          onChange={(event) => setTagInput(event.target.value)}
                          onKeyDown={handleTagKeyDown}
                          placeholder="Add hashtag"
                        />
                        <button
                          type="button"
                          className="create-event-add-tag-btn"
                          onClick={() => handleAddTag()}
                        >
                          Add
                        </button>
                      </div>
                      {suggestedTagOptions.length > 0 ? (
                        <div className="create-event-suggested-tags">
                          <p className="create-event-suggested-label">Suggested</p>
                          <div className="create-event-suggested-list">
                            {suggestedTagOptions.slice(0, 8).map((option) => {
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
                      ) : null}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Location Name</label>
                    <input
                      type="text"
                      placeholder="SSC Ballroom"
                      value={locationName}
                      onChange={handleLocationNameChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Address</label>
                    <div className="create-address-shell">
                      <input
                        type="text"
                        placeholder="30665 Student Services Center Dr"
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

                  <div className="form-row">
                    <div className="form-group">
                      <label>Price</label>
                      <div className="create-segmented-control" role="tablist" aria-label="Price">
                        {["Free", "Paid"].map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`create-segmented-option ${eventType === option ? "active" : ""}`}
                            onClick={() => setEventType(option)}
                          >
                            {option}
                          </button>
                        ))}
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

                  <div className="form-group">
                    <label>Dress Code (optional)</label>
                    <input
                      type="text"
                      placeholder="Casual"
                      value={dressCode}
                      onChange={(event) => setDressCode(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              {safeStepId === "visibility" ? (
                <div className="create-flow-screen-fields">
                  {invitedUsers.length > 0 ? (
                    <div className="flyer-invite-chips">
                      {invitedUsers.map((user) => (
                        <button
                          type="button"
                          key={String(user.id || user.username)}
                          className="flyer-invite-chip"
                          onClick={() => handleToggleInvitedUser(user)}
                          aria-label={`Remove ${user.name || user.username}`}
                        >
                          {user.name || user.username}
                          <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="form-group">
                    <label>Search people you follow</label>
                    <input
                      type="search"
                      placeholder="Find a friend"
                      value={inviteSearch}
                      onChange={(event) => setInviteSearch(event.target.value)}
                    />
                  </div>
                  {inviteSuggestions.length > 0 ? (
                    <ul className="flyer-invite-suggestions">
                      {inviteSuggestions.map((user) => (
                        <li key={String(user.id || user.username)}>
                          <button type="button" onClick={() => handleToggleInvitedUser(user)}>
                            <img
                              src={user.image || user.avatar || DEFAULT_AVATAR_URL}
                              alt=""
                              onError={(event) => {
                                event.currentTarget.src = DEFAULT_AVATAR_URL
                              }}
                            />
                            <span>
                              <strong>{user.name || user.username || "User"}</strong>
                              {user.username ? <em>@{user.username}</em> : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="create-flow-helper">
                      Pick anyone you follow. They&apos;ll get a private invite once you publish.
                    </p>
                  )}
                </div>
              ) : null}

              {safeStepId === "review" ? (
                <div className="create-flow-review">
                  <ul className="create-flow-review-list">
                    {reviewSummary.map((row) => (
                      <li key={row.label} className="create-flow-review-row">
                        <span className="create-flow-review-label">{row.label}</span>
                        <span className="create-flow-review-value">{row.value}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="create-flow-helper">
                    Use Back to update anything that&apos;s off, then hit Publish to go live.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <footer className="create-flow-stage-footer">
            <div className="create-flow-step-counter" aria-hidden="true">
              {currentStepIndex + 1} / {stepOrder.length}
            </div>
            <div className="create-flow-stage-actions">
              {!isFirstStep ? (
                <button
                  type="button"
                  className="create-flow-back"
                  onClick={handlePrevStep}
                >
                  Back
                </button>
              ) : null}
              {safeStepId === "type" ? null : isLastStep ? (
                <button
                  type="button"
                  className="publish-btn create-flow-publish"
                  onClick={handlePublish}
                  disabled={isUploading}
                >
                  {isUploading ? "Publishing..." : "Publish Event"}
                </button>
              ) : (
                <button
                  type="button"
                  className="publish-btn create-flow-next"
                  onClick={handleNextStep}
                >
                  Continue
                </button>
              )}
            </div>
          </footer>
        </section>
      </div>
      )}
    </div>
  )
}

export default CreateEvent
