import React, { useEffect, useRef, useState } from "react"
import { useOutletContext } from "react-router-dom"

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍", "＋"]
const LONG_PRESS_MS = 420

function ActionIcon({ type, size = 20, stroke = 1.9 }) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true",
  }

  switch (type) {
    case "read":
      return (
        <svg {...commonProps}>
          <path d="M4.5 7.5h15v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
          <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "move":
      return (
        <svg {...commonProps}>
          <path d="M4.5 8.5a2 2 0 0 1 2-2h4l1.8 2h5.2a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-8.5Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
          <path d="M10 14h6m0 0-2.2-2.2M16 14l-2.2 2.2" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "label":
      return (
        <svg {...commonProps}>
          <path d="M12.5 4.5H7.8a2 2 0 0 0-1.4.6L4.9 6.6a2 2 0 0 0 0 2.8l7.7 7.7a2 2 0 0 0 2.8 0l3-3a2 2 0 0 0 0-2.8l-4.5-4.5a2 2 0 0 0-1.4-.6Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" />
        </svg>
      )
    case "pin":
      return (
        <svg {...commonProps}>
          <path d="m14 4.5 5.5 5.5-3.1 1-3.5 3.5.5 4-1.4 1.4-3.7-3.7L4.6 19l-.6-.6 3.4-3.7-3.7-3.7 1.4-1.4 4 .5 3.5-3.5 1-3.1Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
        </svg>
      )
    case "mute":
      return (
        <svg {...commonProps}>
          <path d="M14.8 6.2 10.9 10H7.5v4h3.4l3.9 3.8V6.2Z" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
          <path d="m5 5 14 14" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
        </svg>
      )
    case "trash":
      return (
        <svg {...commonProps}>
          <path d="M9.25 5.75h5.5m-8 2.25h10.5m-9 0 .7 9.2a2 2 0 0 0 2 1.8h2.9a2 2 0 0 0 2-1.8l.7-9.2m-6.3 3v4.8m3.4-4.8v4.8M9.8 5.8l.5-1.2a1.8 1.8 0 0 1 1.7-1.1h0a1.8 1.8 0 0 1 1.7 1.1l.5 1.2" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}

function Messages() {
  const {
    defaultAvatar,
    displayDmThreads,
    unreadDmThreadIds,
    selectedDmThread,
    dmMessagesByThread,
    dmDraftMessage,
    setDmDraftMessage,
    openDmThread,
    closeDmThread,
    markDmThreadRead,
    toggleDmThreadPinned,
    toggleDmThreadMuted,
    deleteDmThread,
    handleSendDmMessage,
    handleDeleteDmMessage,
  } = useOutletContext()
  const [activeMessageMenu, setActiveMessageMenu] = useState(null)
  const [activeThreadMenu, setActiveThreadMenu] = useState(null)
  const [messageReactions, setMessageReactions] = useState({})
  const [messageStickers, setMessageStickers] = useState({})
  const [replyingTo, setReplyingTo] = useState(null)
  const messageLongPressTimerRef = useRef(null)
  const threadLongPressTimerRef = useRef(null)
  const suppressThreadClickRef = useRef(false)
  const messageMenuRef = useRef(null)
  const threadMenuRef = useRef(null)

  const selectedMessages = selectedDmThread
    ? dmMessagesByThread[selectedDmThread.id] || []
    : []

  useEffect(() => {
    if (!activeMessageMenu && !activeThreadMenu) return undefined

    const handlePointerDown = (event) => {
      if (messageMenuRef.current?.contains(event.target) || threadMenuRef.current?.contains(event.target)) {
        return
      }

      setActiveMessageMenu(null)
      setActiveThreadMenu(null)
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveMessageMenu(null)
        setActiveThreadMenu(null)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeMessageMenu, activeThreadMenu])

  const clearLongPressTimer = (timerRef) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const openMessageMenu = (message, element) => {
    const rect = element.getBoundingClientRect()
    const menuWidth = 224
    const left = Math.min(
      Math.max(16, message.sender === "me" ? rect.right - menuWidth : rect.left),
      window.innerWidth - menuWidth - 16
    )
    const top = Math.min(Math.max(72, rect.top - 64), window.innerHeight - 240)

    setActiveThreadMenu(null)
    setActiveMessageMenu({
      message,
      left,
      top,
    })
  }

  const openThreadMenu = (thread, element) => {
    const rect = element.getBoundingClientRect()
    const menuWidth = 236
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - menuWidth - 16)
    const top = Math.min(Math.max(72, rect.top + rect.height / 2 - 112), window.innerHeight - 300)

    suppressThreadClickRef.current = true
    setActiveMessageMenu(null)
    setActiveThreadMenu({
      thread,
      left,
      top,
    })
  }

  const handleMessagePointerDown = (event, message) => {
    clearLongPressTimer(messageLongPressTimerRef)
    messageLongPressTimerRef.current = window.setTimeout(() => {
      openMessageMenu(message, event.currentTarget)
    }, LONG_PRESS_MS)
  }

  const handleThreadPointerDown = (event, thread) => {
    clearLongPressTimer(threadLongPressTimerRef)
    threadLongPressTimerRef.current = window.setTimeout(() => {
      openThreadMenu(thread, event.currentTarget)
    }, LONG_PRESS_MS)
  }

  const handleMessageContextMenu = (event, message) => {
    event.preventDefault()
    clearLongPressTimer(messageLongPressTimerRef)
    openMessageMenu(message, event.currentTarget)
  }

  const handleThreadContextMenu = (event, thread) => {
    event.preventDefault()
    clearLongPressTimer(threadLongPressTimerRef)
    openThreadMenu(thread, event.currentTarget)
  }

  const handleThreadClick = (thread) => {
    if (suppressThreadClickRef.current) {
      suppressThreadClickRef.current = false
      return
    }

    openDmThread(thread)
  }

  const handleReaction = (emoji) => {
    if (!activeMessageMenu?.message) return
    const messageId = activeMessageMenu.message.id
    setMessageReactions((prev) => ({ ...prev, [messageId]: emoji }))
    setActiveMessageMenu(null)
  }

  const handleReply = () => {
    setReplyingTo(activeMessageMenu?.message || null)
    setActiveMessageMenu(null)
  }

  const handleAddSticker = () => {
    if (!activeMessageMenu?.message) return
    setMessageStickers((prev) => ({ ...prev, [activeMessageMenu.message.id]: "✨" }))
    setActiveMessageMenu(null)
  }

  const handleDelete = () => {
    if (activeMessageMenu?.message) {
      handleDeleteDmMessage?.(activeMessageMenu.message)
    }
    if (replyingTo?.id === activeMessageMenu?.message?.id) {
      setReplyingTo(null)
    }
    setActiveMessageMenu(null)
  }

  const handleThreadMarkRead = () => {
    if (!activeThreadMenu?.thread) return
    markDmThreadRead?.(activeThreadMenu.thread.id)
    setActiveThreadMenu(null)
  }

  const handleThreadPin = () => {
    if (!activeThreadMenu?.thread) return
    toggleDmThreadPinned?.(activeThreadMenu.thread.id)
    setActiveThreadMenu(null)
  }

  const handleThreadMute = () => {
    if (!activeThreadMenu?.thread) return
    toggleDmThreadMuted?.(activeThreadMenu.thread.id)
    setActiveThreadMenu(null)
  }

  const handleThreadDelete = () => {
    if (!activeThreadMenu?.thread) return
    deleteDmThread?.(activeThreadMenu.thread.id)
    setActiveThreadMenu(null)
  }

  return (
    <main className="messages-page">
      <div className="messages-page-header">
        <p className="eyebrow">A dedicated home for conversations</p>
        <h1>Messages</h1>
        <p className="messages-page-subtitle">
          Keep messages separate from notifications while staying close to your campus plans.
        </p>
      </div>

      <div className="messages-layout">
        <section className="messages-thread-panel">
          <div className="messages-pane-header">
            <h2>Conversations</h2>
            <span className="messages-pane-meta">{displayDmThreads.length} threads</span>
          </div>

          {displayDmThreads.length > 0 ? (
            <div className="inbox-list">
              {displayDmThreads.map((thread) => (
                <button
                  type="button"
                  className={`inbox-item ${unreadDmThreadIds.has(thread.id) ? "inbox-item-unread" : ""} ${activeThreadMenu?.thread?.id === thread.id ? "menu-open" : ""}`}
                  key={thread.id}
                  onClick={() => handleThreadClick(thread)}
                  onPointerDown={(event) => handleThreadPointerDown(event, thread)}
                  onPointerUp={() => clearLongPressTimer(threadLongPressTimerRef)}
                  onPointerLeave={() => clearLongPressTimer(threadLongPressTimerRef)}
                  onPointerCancel={() => clearLongPressTimer(threadLongPressTimerRef)}
                  onContextMenu={(event) => handleThreadContextMenu(event, thread)}
                >
                  <img
                    className="inbox-item-avatar"
                    src={thread.image || defaultAvatar}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = defaultAvatar
                    }}
                  />
                  <div className="inbox-item-main">
                    <span className="inbox-item-text">{thread.name}</span>
                    <span className="inbox-item-preview">{thread.preview}</span>
                    <div className="messages-thread-meta-row">
                      <span className="inbox-item-time">{thread.time}</span>
                      <span className="messages-thread-state">
                        {thread.isPinned ? (
                          <span className="messages-thread-state-pill" aria-label="Pinned">
                            <ActionIcon type="pin" size={12} stroke={2} />
                          </span>
                        ) : null}
                        {thread.isMuted ? (
                          <span className="messages-thread-state-pill" aria-label="Muted">
                            <ActionIcon type="mute" size={12} stroke={2} />
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                  <div className="messages-thread-endcap">
                    {unreadDmThreadIds.has(thread.id) && (
                      <span className="inbox-item-unread-dot" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="messages-empty-card">
              <h3>No conversations yet.</h3>
              <p>Message people from profiles and shared events to start a thread.</p>
            </div>
          )}
        </section>

        <section className="messages-chat-panel">
          {selectedDmThread ? (
            <div className="dm-chat-view messages-chat-view">
              <div className="dm-chat-header messages-chat-header">
                <button
                  type="button"
                  className="dm-chat-back-btn"
                  onClick={closeDmThread}
                  aria-label="Back to conversations"
                >
                  ←
                </button>
                <div className="inbox-item-main">
                  <span className="inbox-item-text">{selectedDmThread.name}</span>
              <span className="inbox-item-time">Messages</span>
                </div>
              </div>

              <div className="dm-chat-messages">
                {selectedMessages.map((message) => (
                  <div
                    className={`dm-chat-bubble ${message.sender}`}
                    key={message.id}
                    onPointerDown={(event) => handleMessagePointerDown(event, message)}
                    onPointerUp={() => clearLongPressTimer(messageLongPressTimerRef)}
                    onPointerLeave={() => clearLongPressTimer(messageLongPressTimerRef)}
                    onPointerCancel={() => clearLongPressTimer(messageLongPressTimerRef)}
                    onContextMenu={(event) => handleMessageContextMenu(event, message)}
                  >
                    {message.text}
                    {messageReactions[message.id] || messageStickers[message.id] ? (
                      <span className="dm-chat-bubble-badges">
                        {messageReactions[message.id] ? (
                          <span>{messageReactions[message.id]}</span>
                        ) : null}
                        {messageStickers[message.id] ? (
                          <span>{messageStickers[message.id]}</span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <form className="dm-chat-input-row" onSubmit={handleSendDmMessage}>
                {replyingTo ? (
                  <div className="dm-replying-banner">
                    <span>
                      Replying to {replyingTo.sender === "me" ? "your message" : selectedDmThread.name}
                    </span>
                    <strong>{replyingTo.text}</strong>
                    <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
                      ×
                    </button>
                  </div>
                ) : null}
                <input
                  type="text"
                  value={dmDraftMessage}
                  onChange={(event) => setDmDraftMessage(event.target.value)}
                  placeholder={`Message ${selectedDmThread.name}`}
                />
                <button type="submit">Send</button>
              </form>

              {activeMessageMenu ? (
                <div
                  className="dm-message-popover"
                  ref={messageMenuRef}
                  style={{
                    left: `${activeMessageMenu.left}px`,
                    top: `${activeMessageMenu.top}px`,
                  }}
                >
                  <div className="dm-message-reaction-bar" aria-label="Quick reactions">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        aria-label={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="dm-message-action-menu" role="menu">
                    <button type="button" role="menuitem" onClick={handleReply}>
                      <span aria-hidden="true">↩</span>
                      Reply
                    </button>
                    <button type="button" role="menuitem" onClick={handleAddSticker}>
                      <span aria-hidden="true">▣</span>
                      Add sticker
                    </button>
                    <button type="button" role="menuitem" className="danger" onClick={handleDelete}>
                      <span aria-hidden="true">⌫</span>
                      Delete message
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="messages-empty-card messages-chat-empty">
              <h3>Select a conversation.</h3>
              <p>Choose a thread from the left to open the full message view.</p>
            </div>
          )}
        </section>
      </div>

      {activeThreadMenu ? (
        <div
          className="dm-thread-popover"
          ref={threadMenuRef}
          style={{
            left: `${activeThreadMenu.left}px`,
            top: `${activeThreadMenu.top}px`,
          }}
        >
          <div className="dm-thread-action-menu" role="menu">
            <button type="button" role="menuitem" onClick={handleThreadMarkRead}>
              <span className="dm-thread-action-icon"><ActionIcon type="read" /></span>
              <span>Mark as read</span>
            </button>
            <button type="button" role="menuitem" disabled>
              <span className="dm-thread-action-icon"><ActionIcon type="move" /></span>
              <span>Move</span>
              <span className="dm-thread-action-note">Soon</span>
            </button>
            <button type="button" role="menuitem" disabled>
              <span className="dm-thread-action-icon"><ActionIcon type="label" /></span>
              <span>Add label</span>
              <span className="dm-thread-action-note">Soon</span>
            </button>
            <button type="button" role="menuitem" onClick={handleThreadPin}>
              <span className="dm-thread-action-icon"><ActionIcon type="pin" /></span>
              <span>{activeThreadMenu.thread.isPinned ? "Unpin" : "Pin"}</span>
            </button>
            <button type="button" role="menuitem" onClick={handleThreadMute}>
              <span className="dm-thread-action-icon"><ActionIcon type="mute" /></span>
              <span>{activeThreadMenu.thread.isMuted ? "Unmute" : "Mute"}</span>
            </button>
            <button type="button" role="menuitem" className="danger" onClick={handleThreadDelete}>
              <span className="dm-thread-action-icon"><ActionIcon type="trash" /></span>
              <span>Delete</span>
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default Messages
