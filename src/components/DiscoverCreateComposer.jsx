import React, { useEffect, useMemo, useRef, useState } from "react"

const CREATE_MODES = [
  { id: "post", label: "Post" },
  { id: "story", label: "Story" },
  { id: "event", label: "Event" },
  { id: "live", label: "Live" },
]

const MEDIA_MODES = new Set(["post", "story"])

function DiscoverCreateComposer({
  isOpen,
  initialMode = "post",
  onClose,
  onSubmitPost,
  onSubmitStory,
  onOpenEventFlow,
}) {
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const [mode, setMode] = useState(initialMode)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [caption, setCaption] = useState("")
  const [postToGrid, setPostToGrid] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isOpen) return
    setMode(initialMode || "post")
  }, [initialMode, isOpen])

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null)
      setCaption("")
      setPostToGrid(true)
      setIsSubmitting(false)
      setError("")
    }
  }, [isOpen])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("")
      return undefined
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(nextPreviewUrl)

    return () => {
      URL.revokeObjectURL(nextPreviewUrl)
    }
  }, [selectedFile])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const isVideo = Boolean(selectedFile?.type?.startsWith("video/"))
  const isMediaMode = MEDIA_MODES.has(mode)

  const headline = useMemo(() => {
    if (mode === "post") return "Create Post"
    if (mode === "story") return "Create Story"
    if (mode === "event") return "Create Event"
    if (mode === "live") return "Go Live"
    return "Create"
  }, [mode])

  const subtitle = useMemo(() => {
    if (mode === "post") {
      return "Capture or upload a photo or video. Posts go into your Discover feed and show on your Posts tab."
    }
    if (mode === "story") {
      return "Upload an image or video, add a caption if you want, and share it to your Discover story slot."
    }
    if (mode === "event") {
      return "Use the full event creator to publish a flyer, location, and details for RSVPs."
    }
    return "Live is coming soon — keep the slider on Post, Story, or Event for now."
  }, [mode])

  if (!isOpen) return null

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const isSupported =
      file.type.startsWith("image/") || file.type.startsWith("video/")

    if (!isSupported) {
      setError("Choose an image or video file.")
      return
    }

    setError("")
    setSelectedFile(file)
  }

  const triggerFilePicker = () => fileInputRef.current?.click()
  const triggerCameraPicker = () => cameraInputRef.current?.click()

  const handleSwitchMode = (nextMode) => {
    if (nextMode === mode) return
    setError("")
    setMode(nextMode)

    if (nextMode === "event") {
      onOpenEventFlow?.()
    }
  }

  const handleSubmit = async () => {
    if (!isMediaMode) return
    if (!selectedFile || isSubmitting) return

    setIsSubmitting(true)
    setError("")

    try {
      if (mode === "post") {
        await Promise.resolve(
          onSubmitPost?.({
            file: selectedFile,
            caption: caption.trim(),
            onGrid: postToGrid,
          })
        )
      } else if (mode === "story") {
        await Promise.resolve(
          onSubmitStory?.({ file: selectedFile, caption: caption.trim() })
        )
      }
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const actionLabel = (() => {
    if (isSubmitting) return mode === "story" ? "Sharing..." : "Posting..."
    if (mode === "post") return "Post"
    if (mode === "story") return "Share Story"
    return ""
  })()

  return (
    <div
      aria-hidden="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "rgba(4, 6, 12, 0.78)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <div
        aria-modal="true"
        role="dialog"
        aria-label="Create"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          borderRadius: "30px",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          background:
            "linear-gradient(180deg, rgba(13, 17, 28, 0.98), rgba(8, 11, 19, 0.98))",
          boxShadow: "0 30px 70px rgba(0, 0, 0, 0.32)",
          color: "var(--text-main, #f5f7fb)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - 48px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "20px 22px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "1.08rem", fontWeight: 800, lineHeight: 1.15 }}>
              {headline}
            </div>
            <div
              style={{
                marginTop: "4px",
                color: "rgba(226, 232, 240, 0.72)",
                fontSize: "0.83rem",
                lineHeight: 1.45,
              }}
            >
              {subtitle}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close create composer"
            style={{
              width: "40px",
              height: "40px",
              border: "none",
              borderRadius: "999px",
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.08)",
              color: "var(--text-main, #f5f7fb)",
              fontSize: "1rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: "1 1 auto" }}>
          {isMediaMode ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.1fr) minmax(260px, 0.9fr)",
                gap: "0",
              }}
            >
              <div
                style={{
                  position: "relative",
                  padding: "20px 22px 24px",
                  borderRight: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />

                <div
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: "24px",
                    minHeight: "420px",
                    background:
                      "radial-gradient(circle at top, rgba(37, 99, 235, 0.18), transparent 34%), linear-gradient(180deg, rgba(20, 26, 38, 0.98), rgba(10, 14, 24, 0.98))",
                    border: "1px dashed rgba(255, 255, 255, 0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedFile && previewUrl ? (
                    isVideo ? (
                      <video
                        src={previewUrl}
                        controls
                        muted
                        loop
                        playsInline
                        style={{
                          width: "100%",
                          height: "100%",
                          maxHeight: "520px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <img
                        src={previewUrl}
                        alt={`${mode} preview`}
                        style={{
                          width: "100%",
                          height: "100%",
                          maxHeight: "520px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "14px",
                        padding: "28px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "72px",
                          height: "72px",
                          borderRadius: "24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(255, 255, 255, 0.08)",
                          fontSize: "1.8rem",
                        }}
                      >
                        +
                      </div>
                      <div style={{ fontSize: "1rem", fontWeight: 700 }}>
                        {mode === "post"
                          ? "Add media for your post"
                          : "Add media for your story"}
                      </div>
                      <div
                        style={{
                          maxWidth: "280px",
                          color: "rgba(226, 232, 240, 0.72)",
                          fontSize: "0.9rem",
                          lineHeight: 1.5,
                        }}
                      >
                        Capture in-app or choose an image or video to preview here before
                        you share it.
                      </div>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                        <button
                          type="button"
                          onClick={triggerCameraPicker}
                          style={{
                            border: "none",
                            borderRadius: "999px",
                            padding: "12px 16px",
                            cursor: "pointer",
                            background: "#f8fafc",
                            color: "#111827",
                            fontSize: "0.86rem",
                            fontWeight: 700,
                          }}
                        >
                          Capture
                        </button>
                        <button
                          type="button"
                          onClick={triggerFilePicker}
                          style={{
                            borderRadius: "999px",
                            padding: "12px 16px",
                            cursor: "pointer",
                            background: "transparent",
                            color: "var(--text-main, #f5f7fb)",
                            fontSize: "0.86rem",
                            fontWeight: 700,
                            border: "1px solid rgba(255, 255, 255, 0.18)",
                          }}
                        >
                          Upload
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedFile && previewUrl ? (
                    <button
                      type="button"
                      onClick={triggerFilePicker}
                      aria-label="Upload media"
                      style={{
                        position: "absolute",
                        top: "14px",
                        right: "14px",
                        border: "none",
                        borderRadius: "999px",
                        padding: "10px 14px",
                        cursor: "pointer",
                        background: "rgba(15, 23, 42, 0.72)",
                        color: "#f8fafc",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        backdropFilter: "blur(6px)",
                        WebkitBackdropFilter: "blur(6px)",
                      }}
                    >
                      Upload
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  padding: "20px 22px 24px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label
                    htmlFor="discover-create-caption"
                    style={{
                      color: "var(--text-main, #f5f7fb)",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                    }}
                  >
                    Caption
                  </label>
                  <textarea
                    id="discover-create-caption"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    rows={6}
                    placeholder={
                      mode === "post"
                        ? "Say something about this post..."
                        : "Write something for this story..."
                    }
                    style={{
                      width: "100%",
                      resize: "vertical",
                      borderRadius: "18px",
                      padding: "14px 16px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      background: "rgba(255, 255, 255, 0.04)",
                      color: "var(--text-main, #f5f7fb)",
                      font: "inherit",
                      lineHeight: 1.5,
                      outline: "none",
                    }}
                  />
                </div>

                <div
                  style={{
                    borderRadius: "20px",
                    padding: "14px 16px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "var(--text-main, #f5f7fb)",
                    }}
                  >
                    {mode === "post" ? "Posts publish to Discover" : "Story publishing"}
                  </div>
                  <div
                    style={{
                      marginTop: "6px",
                      color: "rgba(226, 232, 240, 0.68)",
                      fontSize: "0.82rem",
                      lineHeight: 1.45,
                    }}
                  >
                    {mode === "post"
                      ? "Your image or video will show up in the Discover feed and on your Posts tab."
                      : "Your image or video will upload to the shared stories feed so other people can see it in Discover too."}
                  </div>
                </div>

                {mode === "post" ? (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                      borderRadius: "20px",
                      padding: "14px 16px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                    }}
                  >
                    <span>
                      <span
                        style={{
                          display: "block",
                          color: "var(--text-main, #f5f7fb)",
                          fontSize: "0.84rem",
                          fontWeight: 800,
                        }}
                      >
                        Post to Grid
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: "4px",
                          color: "rgba(226, 232, 240, 0.68)",
                          fontSize: "0.8rem",
                          lineHeight: 1.35,
                        }}
                      >
                        Add this to your curated profile canvas.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={postToGrid}
                      onChange={(event) => setPostToGrid(event.target.checked)}
                      style={{
                        width: "22px",
                        height: "22px",
                        accentColor: "#f8fafc",
                        flex: "0 0 auto",
                      }}
                    />
                  </label>
                ) : null}

                {error ? (
                  <div
                    role="alert"
                    style={{
                      borderRadius: "14px",
                      padding: "10px 14px",
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.35)",
                      color: "#fecaca",
                      fontSize: "0.82rem",
                    }}
                  >
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "32px 28px 28px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255, 255, 255, 0.06)",
                  fontSize: "1.8rem",
                }}
              >
                {mode === "event" ? "🎟" : "●"}
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>
                {mode === "event" ? "Open the full event creator" : "Live is coming soon"}
              </div>
              <div
                style={{
                  maxWidth: "380px",
                  color: "rgba(226, 232, 240, 0.72)",
                  fontSize: "0.88rem",
                  lineHeight: 1.5,
                }}
              >
                {mode === "event"
                  ? "Events keep their own publishing flow. Tap the button below to open the event creator while staying in the same create experience."
                  : "We're still wiring live broadcasting. Slide back to Post or Story to share something right now."}
              </div>
              {mode === "event" ? (
                <button
                  type="button"
                  onClick={() => onOpenEventFlow?.()}
                  style={{
                    border: "none",
                    borderRadius: "999px",
                    padding: "12px 18px",
                    cursor: "pointer",
                    background: "#f8fafc",
                    color: "#111827",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                  }}
                >
                  Open Event Creator
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 22px 18px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            role="tablist"
            aria-label="Create mode"
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: `repeat(${CREATE_MODES.length}, minmax(0, 1fr))`,
              padding: "4px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {CREATE_MODES.map((option) => {
              const isActive = mode === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleSwitchMode(option.id)}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    border: "none",
                    borderRadius: "999px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: isActive ? "#f8fafc" : "transparent",
                    color: isActive ? "#111827" : "rgba(226, 232, 240, 0.82)",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    transition: "background 160ms ease, color 160ms ease",
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          {isMediaMode ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  borderRadius: "999px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  background: "transparent",
                  color: "rgba(226, 232, 240, 0.8)",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedFile || isSubmitting}
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "12px 20px",
                  cursor: selectedFile && !isSubmitting ? "pointer" : "not-allowed",
                  opacity: selectedFile && !isSubmitting ? 1 : 0.5,
                  background: "#f8fafc",
                  color: "#111827",
                  fontSize: "0.88rem",
                  fontWeight: 800,
                }}
              >
                {actionLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default DiscoverCreateComposer
