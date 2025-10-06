import React, { useState, useEffect, useRef } from "react";
import ProfileView from "./ProfileView.js";
import ProfileEdit from "./ProfileEdit.js";
import ContextMenu from "./ContextMenu.js";
import "./Chat.css";

const Chat = ({ username, onLogout, authManager }) => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileAvatars, setProfileAvatars] = useState({});
  const [myProfile, setMyProfile] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState(new Set());
  const [blockStatus, setBlockStatus] = useState({});
  const messagesEndRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket("ws://localhost:3001");

      ws.onopen = () => {
        console.log("WebSocket connected");
        ws.send(JSON.stringify({ type: "register", username }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "new_message") {
            console.log("New message from:", data.from);
            pollMessages();
          } else if (data.type === "profile_updated") {
            console.log("Profile updated:", data.username);
            invalidateProfileCache(data.username);
            loadProfileAvatarsBatch([data.username]);
          } else if (data.type === "blocked") {
            console.log("Blocked by:", data.by);
            
            // Если открыт чат с тем, кто заблокировал - закрыть
            if (selectedChat?.username === data.by) {
              setSelectedChat(null);
            }
            
            checkBlockStatus(data.by);
          } else if (data.type === "unblocked") {
            console.log("Unblocked by:", data.by);
            checkBlockStatus(data.by);
          } else if (data.type === "block_confirmed") {
            console.log("Block confirmed for:", data.username);
            
            // Закрываем чат у блокирующего тоже
            if (selectedChat?.username === data.username) {
              setSelectedChat(null);
            }
            
            checkBlockStatus(data.username);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [username, selectedChat]);

  useEffect(() => {
    loadMyProfile();
  }, [username]);

  useEffect(() => {
    const missingAvatars = contacts
      .map((c) => c.username)
      .filter((username) => !profileAvatars[username]);

    if (missingAvatars.length > 0) {
      loadProfileAvatarsBatch(missingAvatars);
    }
  }, [contacts]);

  useEffect(() => {
    if (selectedChat) {
      checkBlockStatus(selectedChat.username);
    }
  }, [selectedChat]);

  const loadMyProfile = async () => {
    try {
      const response = await fetch(
        `${authManager.serverUrl}/profile/${username}`
      );
      if (response.ok) {
        const data = await response.json();
        setMyProfile(data);
        setProfileAvatars((prev) => ({
          ...prev,
          [username]: data.avatar || null,
        }));
      }
    } catch (error) {
      console.error("Failed to load my profile:", error);
    }
  };

  const loadProfileAvatarsBatch = async (usernames) => {
    try {
      const response = await fetch(`${authManager.serverUrl}/profiles/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames }),
      });

      if (response.ok) {
        const profileMap = await response.json();
        setProfileAvatars((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(profileMap).map(([username, profile]) => [
              username,
              profile.avatar || null,
            ])
          ),
        }));
      }
    } catch (error) {
      console.error("Failed to load avatars batch:", error);
    }
  };

  const invalidateProfileCache = (username) => {
    setProfileAvatars((prev) => {
      const updated = { ...prev };
      delete updated[username];
      return updated;
    });
  };

  const handleProfileEditClose = async () => {
    setEditingProfile(false);
    invalidateProfileCache(username);
    await loadMyProfile();
    setTimeout(() => {
      loadProfileAvatarsBatch([username]);
    }, 100);
  };

  const checkBlockStatus = async (contactUsername) => {
    try {
      const response = await fetch(
        `${authManager.serverUrl}/block-status/${username}/${contactUsername}`
      );
      if (response.ok) {
        const data = await response.json();
        setBlockStatus((prev) => ({
          ...prev,
          [contactUsername]: data,
        }));

        if (data.blocked) {
          setBlockedUsers((prev) => new Set(prev).add(contactUsername));
        } else {
          setBlockedUsers((prev) => {
            const updated = new Set(prev);
            updated.delete(contactUsername);
            return updated;
          });
        }
      }
    } catch (error) {
      console.error("Failed to check block status:", error);
    }
  };

  const handleContextMenu = (e, contact) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      contact,
    });
  };

  const handleClearChat = async (contactUsername) => {
    if (!window.confirm(`Очистить историю с ${contactUsername}?`)) return;

    try {
      // Очищаем сообщения локально
      setMessages((prev) => ({
        ...prev,
        [contactUsername]: [],
      }));

      if (authManager.storage) {
        await authManager.storage.clearChatHistory(contactUsername);
      }

      console.log(`История с ${contactUsername} очищена локально`);
    } catch (error) {
      console.error("Failed to clear chat:", error);
      alert("Не удалось очистить историю");
    }
  };

  const handleDeleteChat = async (contactUsername) => {
    if (
      !window.confirm(
        `Удалить чат с ${contactUsername}?\n\nЭто удалит чат только у вас.`
      )
    )
      return;

    try {
      // Помечаем контакт как удалённый
      if (authManager.storage) {
        await authManager.storage.markContactAsDeleted(contactUsername);
        await authManager.storage.clearChatHistory(contactUsername);
      }

      // Убираем из UI
      setContacts((prev) =>
        prev.filter((c) => c.username !== contactUsername)
      );
      
      setMessages((prev) => {
        const updated = { ...prev };
        delete updated[contactUsername];
        return updated;
      });

      if (selectedChat?.username === contactUsername) {
        setSelectedChat(null);
      }

      console.log(`Чат с ${contactUsername} удалён`);
    } catch (error) {
      console.error("Failed to delete chat:", error);
      alert("Не удалось удалить чат");
    }
  };

  const handleBlockUser = async (contactUsername) => {
    try {
      const response = await fetch(`${authManager.serverUrl}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocker: username, blocked: contactUsername }),
      });

      if (response.ok) {
        setBlockedUsers((prev) => new Set(prev).add(contactUsername));
        
        // Закрываем чат если он открыт
        if (selectedChat?.username === contactUsername) {
          setSelectedChat(null);
        }
        
        // Обновляем статус блокировки
        await checkBlockStatus(contactUsername);
        
        console.log(`${contactUsername} заблокирован`);
      }
    } catch (error) {
      console.error("Failed to block user:", error);
      alert("Не удалось заблокировать пользователя");
    }
  };

  const handleUnblockUser = async (contactUsername) => {
    try {
      const response = await fetch(`${authManager.serverUrl}/unblock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocker: username, blocked: contactUsername }),
      });

      if (response.ok) {
        setBlockedUsers((prev) => {
          const updated = new Set(prev);
          updated.delete(contactUsername);
          return updated;
        });
        
        await checkBlockStatus(contactUsername);
        
        console.log(`${contactUsername} разблокирован`);
      }
    } catch (error) {
      console.error("Failed to unblock user:", error);
      alert("Не удалось разблокировать пользователя");
    }
  };

  const pollMessages = async () => {
    try {
      const newMessages = await authManager.fetchMessages();

      if (newMessages.length > 0) {
        const messagesByContact = {};

        for (const msg of newMessages) {
          const sender = msg.sender || "unknown";

          if (!messagesByContact[sender]) {
            messagesByContact[sender] = [];
          }

          messagesByContact[sender].push({
            text: msg.text,
            timestamp: msg.timestamp,
            isOutgoing: false,
          });
        }

        setMessages((prev) => {
          const updated = { ...prev };
          Object.keys(messagesByContact).forEach((sender) => {
            updated[sender] = [
              ...(updated[sender] || []),
              ...messagesByContact[sender],
            ];
          });
          return updated;
        });

        setContacts((prev) => {
          const newContacts = [...prev];
          Object.keys(messagesByContact).forEach((sender) => {
            if (!newContacts.find((c) => c.username === sender)) {
              newContacts.push({
                id: Date.now() + Math.random(),
                username: sender,
                lastMessage: messagesByContact[sender][0].text,
                timestamp: new Date(
                  messagesByContact[sender][0].timestamp
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                unread: 1,
              });
            }
          });
          return newContacts;
        });
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const Avatar = ({ username, size = 50 }) => {
    const avatar = profileAvatars[username];
    const letter = username[0].toUpperCase();

    const style = {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      background: avatar
        ? "transparent"
        : "linear-gradient(135deg, #58a6ff 0%, #7c3aed 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: `${size / 2.5}px`,
      fontWeight: 600,
      color: "white",
      flexShrink: 0,
      overflow: "hidden",
    };

    return (
      <div style={style}>
        {avatar ? (
          <img
            src={avatar}
            alt={username}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span>{letter}</span>
        )}
      </div>
    );
  };

  useEffect(() => {
    const loadContactsFromStorage = async () => {
      if (!authManager.storage) return;

      try {
        const storedContacts = await authManager.storage.getAllContacts();

        const formattedContacts = storedContacts.map((contact, index) => ({
          id: Date.now() + index,
          username: contact.username,
          lastMessage: "Сохранённый контакт",
          timestamp: new Date(contact.addedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          unread: 0,
        }));

        setContacts(formattedContacts);
        console.log(
          `Загружено ${formattedContacts.length} контактов из хранилища`
        );
      } catch (error) {
        console.error("Failed to load contacts:", error);
      }
    };

    loadContactsFromStorage();
  }, [authManager.storage]);

  useEffect(() => {
    pollMessages();
    const interval = setInterval(pollMessages, 5000);
    return () => clearInterval(interval);
  }, [authManager]);

  useEffect(() => {
    if (selectedChat && authManager.storage) {
      loadChatHistory(selectedChat.username);
    }
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedChat]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && selectedChat) {
        setSelectedChat(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedChat]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length > 0) {
      searchTimeoutRef.current = setTimeout(async () => {
        await handleSearchUser(searchQuery.trim());
      }, 800);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadChatHistory = async (contactUsername) => {
    try {
      if (!authManager.storage) return;

      const history = await authManager.storage.getChatHistory(contactUsername);

      const formattedMessages = history.map((msg) => {
        let text = msg.message.body || msg.message;

        if (typeof text === "object" && text !== null && !Array.isArray(text)) {
          text = JSON.stringify(text);
        } else if (Array.isArray(text)) {
          text = new TextDecoder().decode(new Uint8Array(text));
        } else if (typeof text !== "string") {
          text = String(text);
        }

        return {
          text: text,
          timestamp: msg.timestamp,
          isOutgoing: msg.isOutgoing,
        };
      });

      setMessages((prev) => ({
        ...prev,
        [contactUsername]: formattedMessages,
      }));
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  };

  const handleSearchUser = async (searchUsername) => {
    if (contacts.find((c) => c.username === searchUsername)) {
      return;
    }

    setSearchLoading(true);
    try {
      const result = await authManager.searchUser(searchUsername);

      if (result.found) {
        const newContact = {
          id: Date.now(),
          username: searchUsername,
          lastMessage: "Новый контакт",
          timestamp: "Сейчас",
          unread: 0,
        };

        setContacts((prev) => [...prev, newContact]);
        
        await loadProfileAvatarsBatch([searchUsername]);
        
        console.log(`Пользователь ${searchUsername} найден и добавлен`);
      }
    } catch (error) {
      console.error("Failed to search user:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;

    const currentBlockStatus = blockStatus[selectedChat.username];
    if (currentBlockStatus?.blocked) {
      alert("Невозможно отправить сообщение - пользователь заблокирован");
      return;
    }

    setLoading(true);
    try {
      await authManager.sendMessage(selectedChat.username, messageText);

      const newMessage = {
        text: messageText,
        timestamp: Date.now(),
        isOutgoing: true,
      };

      setMessages((prev) => ({
        ...prev,
        [selectedChat.username]: [
          ...(prev[selectedChat.username] || []),
          newMessage,
        ],
      }));

      setContacts((prev) =>
        prev.map((c) =>
          c.username === selectedChat.username
            ? { ...c, lastMessage: messageText, timestamp: "Сейчас" }
            : c
        )
      );

      setMessageText("");
      console.log("Message sent successfully");
    } catch (error) {
      console.error("Failed to send message:", error);
      if (error.message.includes("blocked")) {
        alert("Невозможно отправить сообщение - пользователь заблокирован");
      } else {
        alert("Не удалось отправить сообщение: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentMessages = selectedChat
    ? messages[selectedChat.username] || []
    : [];

  const currentBlockStatus = selectedChat
    ? blockStatus[selectedChat.username]
    : null;
  const isBlocked = currentBlockStatus?.blocked;
  const iBlockedThem = isBlocked && currentBlockStatus?.blocker === username;
  const theyBlockedMe =
    isBlocked && currentBlockStatus?.blocker === selectedChat?.username;
  const whoBlockedWhom = iBlockedThem
    ? "Вы заблокировали этого пользователя"
    : "Вы заблокированы этим пользователем";

  return (
    <div className="chat-page">
      {viewingProfile && (
        <ProfileView
          username={viewingProfile}
          currentUser={username}
          onClose={() => setViewingProfile(null)}
          onBlock={handleBlockUser}
          onUnblock={handleUnblockUser}
          isBlocked={iBlockedThem}
          authManager={authManager}
        />
      )}

      {editingProfile && (
        <ProfileEdit
          username={username}
          onClose={handleProfileEditClose}
          authManager={authManager}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "Очистить историю",
              icon: (
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="currentColor"
                    d="M19.36,2.72L20.78,4.14L15.06,9.85C16.13,11.39 16.28,13.24 15.38,14.44L9.06,8.12C10.26,7.22 12.11,7.37 13.65,8.44L19.36,2.72M5.93,17.57C3.92,15.56 2.69,13.16 2.35,10.92L7.23,8.83L14.67,16.27L12.58,21.15C10.34,20.81 7.94,19.58 5.93,17.57Z"
                  />
                </svg>
              ),
              onClick: () => handleClearChat(contextMenu.contact.username),
            },
            {
              label: blockedUsers.has(contextMenu.contact.username)
                ? "Разблокировать"
                : "Заблокировать",
              icon: (
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="currentColor"
                    d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12C18,14.22 16.79,16.16 15,17.2V15A4,4 0 0,0 11,11H13A2,2 0 0,1 15,13V15.17C14.07,15.71 13,16 12,16A6,6 0 0,1 6,12A6,6 0 0,1 12,6Z"
                  />
                </svg>
              ),
              onClick: () =>
                blockedUsers.has(contextMenu.contact.username)
                  ? handleUnblockUser(contextMenu.contact.username)
                  : handleBlockUser(contextMenu.contact.username),
            },
            { divider: true },
            {
              label: "Удалить чат",
              icon: (
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="currentColor"
                    d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"
                  />
                </svg>
              ),
              danger: true,
              onClick: () => handleDeleteChat(contextMenu.contact.username),
            },
          ]}
        />
      )}

      <div
        className={`burger-menu-overlay ${menuOpen ? "visible" : ""}`}
        onClick={() => setMenuOpen(false)}
      ></div>

      <div className="chat-layout">
        <div className="burger-strip">
          <button
            className="burger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <div className={`burger-panel ${menuOpen ? "open" : ""}`}>
          <div className="user-profile">
            <Avatar username={username} size={60} />
            <div className="user-info">
              <h3>{myProfile?.displayName || username}</h3>
              <p className="user-status">{myProfile?.status || "В сети"}</p>
            </div>
          </div>

          <nav className="burger-nav">
            <button
              className="nav-item"
              onClick={() => {
                setEditingProfile(true);
                setMenuOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
                />
              </svg>
              <span>Мой профиль</span>
            </button>

            <button className="nav-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="currentColor"
                  d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
                />
              </svg>
              <span>Настройки</span>
            </button>

            <button className="nav-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="currentColor"
                  d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
                />
              </svg>
              <span>Приватность</span>
            </button>

            <button className="nav-item nav-item-danger" onClick={onLogout}>
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path
                  fill="currentColor"
                  d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
                />
              </svg>
              <span>Выйти</span>
            </button>
          </nav>
        </div>

        <div className="sidebar">
          <div className="search-container">
            <svg
              className="search-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
            >
              <path
                fill="currentColor"
                d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
              />
            </svg>
            <input
              type="text"
              placeholder="Поиск или добавить @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchLoading && <div className="search-loading">Поиск...</div>}
          </div>

          <div className="contact-list">
            {filteredContacts.length === 0 ? (
              <div className="no-contacts">
                <p>Контакты не найдены</p>
                <p className="hint-text">Введите @username в поле поиска</p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`contact-item ${selectedChat?.id === contact.id ? "active" : ""}`}
                  onClick={() => setSelectedChat(contact)}
                  onContextMenu={(e) => handleContextMenu(e, contact)}
                >
                  <Avatar username={contact.username} size={50} />
                  <div className="contact-info">
                    <div className="contact-header">
                      <span className="contact-name">{contact.username}</span>
                      <span className="contact-time">{contact.timestamp}</span>
                    </div>
                    <div className="contact-message">
                      <p>{contact.lastMessage}</p>
                      {contact.unread > 0 && (
                        <span className="unread-badge">{contact.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-window">
          {selectedChat ? (
            <>
              <div
                className="chat-header"
                onClick={() => setViewingProfile(selectedChat.username)}
                style={{ cursor: "pointer" }}
                title="Открыть профиль"
              >
                <div className="chat-header-info">
                  <Avatar username={selectedChat.username} size={45} />
                  <div>
                    <h3>{selectedChat.username}</h3>
                    <p className="chat-status">
                      {isBlocked ? whoBlockedWhom : "был(а) недавно"}
                    </p>
                  </div>
                </div>
                <div
                  className="chat-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="icon-btn">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path
                        fill="currentColor"
                        d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                      />
                    </svg>
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setSelectedChat(null)}
                    title="Закрыть чат (ESC)"
                  >
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path
                        fill="currentColor"
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="messages-area">
                {currentMessages.length === 0 ? (
                  <div className="empty-chat">
                    <svg viewBox="0 0 24 24" width="80" height="80">
                      <path
                        fill="currentColor"
                        opacity="0.3"
                        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
                      />
                    </svg>
                    <p>История сообщений пуста</p>
                    <span>Отправьте первое сообщение</span>
                  </div>
                ) : (
                  <div className="messages-list">
                    {currentMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`message ${msg.isOutgoing ? "outgoing" : "incoming"}`}
                      >
                        <div className="message-bubble">
                          <p>{msg.text}</p>
                          <span className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="message-input-container">
                {isBlocked ? (
                  <div className="blocked-input-message">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path
                        fill="currentColor"
                        d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12C18,14.22 16.79,16.16 15,17.2V15A4,4 0 0,0 11,11H13A2,2 0 0,1 15,13V15.17C14.07,15.71 13,16 12,16A6,6 0 0,1 6,12A6,6 0 0,1 12,6Z"
                      />
                    </svg>
                    <span>{whoBlockedWhom}</span>
                  </div>
                ) : (
                  <>
                    <button className="icon-btn" title="Прикрепить файл">
                      <svg viewBox="0 0 24 24" width="24" height="24">
                        <path
                          fill="currentColor"
                          d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                        />
                      </svg>
                    </button>
                    <input
                      type="text"
                      placeholder="Введите сообщение..."
                      className="message-input"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                    />
                    <button className="icon-btn" title="Эмодзи">
                      <svg viewBox="0 0 24 24" width="24" height="24">
                        <path
                          fill="currentColor"
                          d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"
                        />
                      </svg>
                    </button>
                    {messageText.trim() ? (
                      <button
                        className="send-btn"
                        onClick={handleSendMessage}
                        title="Отправить"
                        disabled={loading}
                      >
                        <svg viewBox="0 0 24 24" width="24" height="24">
                          <path
                            fill="currentColor"
                            d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
                          />
                        </svg>
                      </button>
                    ) : (
                      <button className="send-btn" title="Голосовое сообщение">
                        <svg viewBox="0 0 24 24" width="24" height="24">
                          <path
                            fill="currentColor"
                            d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"
                          />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg viewBox="0 0 24 24" width="120" height="120">
                  <path
                    fill="currentColor"
                    opacity="0.3"
                    d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
                  />
                </svg>
              </div>
              <h2>Выберите чат</h2>
              <p>Выберите контакт из списка слева, чтобы начать общение</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;