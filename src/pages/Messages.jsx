import React, { useEffect, useRef, useState } from "react"
import { useOutletContext } from "react-router-dom"

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍", "＋"]
const LONG_PRESS_MS = 420

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
    handleSendDmMessage,
    handleDeleteDmMessage,
  } = useOutletContext()
  const [activeMessageMenu, setActiveMessageMenu] = useState(null)
  const [messageReactions, setMessageReactions] = useState({})
  const [messageStickers, setMessageStickers] = useState({})
  const [replyingTo, setReplyingTo] = useState(null)
  const longPressTimerRef = useRef(null)
  const menuRef = useRef(null)

  const selectedMessages = selectedDmThread
    ? dmMessagesByThread[selectedDmThread.id] || []
    : []

  useEffect(() => {
    if (!activeMessageMenu) return undefined

    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return
      setActiveMessageMenu(null)
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveMessageMenu(null)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeMessageMenu])

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const openMessageMenu = (message, element) => {
    const rect = element.getBoundingClientRect()
    const menuWidth = 260
    const left = Math.min(
      Math.max(16, message.sender === "me" ? rect.right - menuWidth : rect.left),
      window.innerWidth - menuWidth - 16
    )
    const top = Math.min(Math.max(72, rect.top - 76), window.innerHeight - 330)

    setActiveMessageMenu({
      message,
      left,
      top,
    })
  }

  const handleMessagePointerDown = (event, message) => {
    clearLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => {
      openMessageMenu(message, event.currentTarget)
    }, LONG_PRESS_MS)
  }

  const handleMessageContextMenu = (event, message) => {
    event.preventDefault()
    clearLongPressTimer()
    openMessageMenu(message, event.currentTarget)
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

  return (
    <main className="messages-page">
      <div className="messages-page-header">
        <p className="eyebrow">A dedicated home for conversations</p>
        <h1>DMs</h1>
        <p className="messages-page-subtitle">
          Keep direct messages separate from notifications while staying close to your campus plans.
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
                  className={`inbox-item ${unreadDmThreadIds.has(thread.id) ? "inbox-item-unread" : ""}`}
                  key={thread.id}
                  onClick={() => openDmThread(thread)}
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
                    <span className="inbox-item-time">{thread.time}</span>
                  </div>
                  {unreadDmThreadIds.has(thread.id) && (
                    <span className="inbox-item-unread-dot" />
                  )}
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
                  <span className="inbox-item-time">Direct messages</span>
                </div>
              </div>

              <div className="dm-chat-messages">
                {selectedMessages.map((message) => (
                  <div
                    className={`dm-chat-bubble ${message.sender}`}
                    key={message.id}
                    onPointerDown={(event) => handleMessagePointerDown(event, message)}
                    onPointerUp={clearLongPressTimer}
                    onPointerLeave={clearLongPressTimer}
                    onPointerCancel={clearLongPressTimer}
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
                  ref={menuRef}
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
    </main>
  )
}

export default Messages
