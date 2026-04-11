import React, { useEffect, useRef, useState } from "react"

function DiscoverStoryComposer({ isOpen, onClose, onSubmit }) {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [caption, setCaption] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    if (!isOpen) {
      setSelectedFile(null)
      setCaption("")
      setIsSubmitting(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isVideo = Boolean(selectedFile?.type?.startsWith("video/"))

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    const isSupported =
      file.type.startsWith("image/") || file.type.startsWith("video/")

    if (!isSupported) {
      window.alert("Choose an image or video file for your story.")
      return
    }

    setSelectedFile(file)
  }

  const triggerFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleSubmit = async () => {
    if (!selectedFile || isSubmitting) return

    setIsSubmitting(true)

    try {
      await Promise.resolve(
        onSubmit({
          file: selectedFile,
          caption: caption.trim(),
        })
      )
    } finally {
      setIsSubmitting(false)
    }
  }

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
        aria-label="Create story"
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
              Create Story
            </div>
            <div
              style={{
                marginTop: "4px",
                color: "rgba(226, 232, 240, 0.72)",
                fontSize: "0.83rem",
                lineHeight: 1.45,
              }}
            >
              Upload an image or video, add a caption if you want, and share it to your
              Discover story slot.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close story composer"
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)",
            gap: "0",
          }}
        >
          <div
            style={{
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
                    alt="Story preview"
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
                    Add media for your story
                  </div>
                  <div
                    style={{
                      maxWidth: "280px",
                      color: "rgba(226, 232, 240, 0.72)",
                      fontSize: "0.9rem",
                      lineHeight: 1.5,
                    }}
                  >
                    Choose an image or video to preview here before you share it.
                  </div>
                  <button
                    type="button"
                    onClick={triggerFilePicker}
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
                    Upload Media
                  </button>
                </div>
              )}
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <label
                htmlFor="discover-story-caption"
                style={{
                  color: "var(--text-main, #f5f7fb)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                }}
              >
                Caption
              </label>
              <textarea
                id="discover-story-caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={6}
                placeholder="Write something for this story..."
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
                Web composer fallback
              </div>
              <div
                style={{
                  marginTop: "6px",
                  color: "rgba(226, 232, 240, 0.68)",
                  fontSize: "0.82rem",
                  lineHeight: 1.45,
                }}
              >
                The web story backend is not wired yet, so shared stories stay in this browser
                session for now.
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "auto" }}>
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
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                {selectedFile ? "Replace Media" : "Choose File"}
              </button>

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
                  border: "1px solid rgba(255, 255, 255, 0.08)",
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
                  padding: "12px 18px",
                  cursor: selectedFile && !isSubmitting ? "pointer" : "not-allowed",
                  opacity: selectedFile && !isSubmitting ? 1 : 0.5,
                  background: "#f8fafc",
                  color: "#111827",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                }}
              >
                {isSubmitting ? "Sharing..." : "Share Story"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DiscoverStoryComposer
