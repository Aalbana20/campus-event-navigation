import React from "react"
import { useOutletContext } from "react-router-dom"

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
  } = useOutletContext()

  const selectedMessages = selectedDmThread
    ? dmMessagesByThread[selectedDmThread.id] || []
    : []

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
                  >
                    {message.text}
                  </div>
                ))}
              </div>

              <form className="dm-chat-input-row" onSubmit={handleSendDmMessage}>
                <input
                  type="text"
                  value={dmDraftMessage}
                  onChange={(event) => setDmDraftMessage(event.target.value)}
                  placeholder={`Message ${selectedDmThread.name}`}
                />
                <button type="submit">Send</button>
              </form>
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
