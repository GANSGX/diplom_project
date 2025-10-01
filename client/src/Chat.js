import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

const Chat = ({ username, onLogout, authManager }) => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Polling для получения новых сообщений каждые 3 секунды
  useEffect(() => {
    const pollMessages = async () => {
      try {
        const newMessages = await authManager.fetchMessages();
        
        if (newMessages.length > 0) {
          const messagesByContact = {};
          
          for (const msg of newMessages) {
            const sender = msg.sender || 'unknown';
            
            if (!messagesByContact[sender]) {
              messagesByContact[sender] = [];
            }
            
            messagesByContact[sender].push({
              text: msg.text,
              timestamp: msg.timestamp,
              isOutgoing: false
            });
          }
          
          setMessages(prev => {
            const updated = { ...prev };
            Object.keys(messagesByContact).forEach(sender => {
              updated[sender] = [...(updated[sender] || []), ...messagesByContact[sender]];
            });
            return updated;
          });

          setContacts(prev => {
            const newContacts = [...prev];
            Object.keys(messagesByContact).forEach(sender => {
              if (!newContacts.find(c => c.username === sender)) {
                newContacts.push({
                  id: Date.now() + Math.random(),
                  username: sender,
                  lastMessage: messagesByContact[sender][0].text,
                  timestamp: new Date(messagesByContact[sender][0].timestamp).toLocaleTimeString(),
                  unread: 1
                });
              }
            });
            return newContacts;
          });
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    pollMessages();
    const interval = setInterval(pollMessages, 3000);
    return () => clearInterval(interval);
  }, [authManager]);

  // Загрузка истории сообщений при выборе чата
  useEffect(() => {
    if (selectedChat && authManager.storage) {
      loadChatHistory(selectedChat.username);
    }
  }, [selectedChat]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChat]);

  // Закрытие чата по ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && selectedChat) {
        setSelectedChat(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedChat]);

  // Поиск пользователя при вводе в поле поиска
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
      
      const formattedMessages = history.map(msg => ({
        text: msg.message.body ? new TextDecoder().decode(new Uint8Array(msg.message.body)) : msg.message,
        timestamp: msg.timestamp,
        isOutgoing: msg.isOutgoing
      }));
      
      setMessages(prev => ({
        ...prev,
        [contactUsername]: formattedMessages
      }));
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const handleSearchUser = async (username) => {
    if (contacts.find(c => c.username === username)) {
      return;
    }

    setSearchLoading(true);
    try {
      const result = await authManager.searchUser(username);
      
      if (result.found) {
        const newContact = {
          id: Date.now(),
          username: username,
          lastMessage: 'Новый контакт',
          timestamp: 'Сейчас',
          unread: 0
        };
        
        setContacts(prev => [...prev, newContact]);
        console.log(`Пользователь ${username} найден и добавлен`);
      }
    } catch (error) {
      console.error('Failed to search user:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;
    
    setLoading(true);
    try {
      await authManager.sendMessage(selectedChat.username, messageText);
      
      const newMessage = {
        text: messageText,
        timestamp: Date.now(),
        isOutgoing: true
      };
      
      setMessages(prev => ({
        ...prev,
        [selectedChat.username]: [...(prev[selectedChat.username] || []), newMessage]
      }));
      
      setContacts(prev => prev.map(c => 
        c.username === selectedChat.username 
          ? { ...c, lastMessage: messageText, timestamp: 'Сейчас' }
          : c
      ));
      
      setMessageText('');
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Не удалось отправить сообщение');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentMessages = selectedChat ? (messages[selectedChat.username] || []) : [];

  return (
    <div className="chat-page">
      <div className={`burger-menu-overlay ${menuOpen ? 'visible' : ''}`} onClick={() => setMenuOpen(false)}></div>

      <div className="chat-layout">
        <div className="burger-strip">
          <button className="burger-btn" onClick={() => setMenuOpen(!menuOpen)}>
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <div className={`burger-panel ${menuOpen ? 'open' : ''}`}>
          <div className="user-profile">
            <div className="user-avatar">{username[0].toUpperCase()}</div>
            <div className="user-info">
              <h3>{username}</h3>
              <p className="user-status">В сети</p>
            </div>
          </div>

          <nav className="burger-nav">
            <button className="nav-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
              </svg>
              <span>Мой профиль</span>
            </button>

            <button className="nav-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
              <span>Настройки</span>
            </button>

            <button className="nav-item">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
              </svg>
              <span>Приватность</span>
            </button>

            <button className="nav-item nav-item-danger" onClick={onLogout}>
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
              <span>Выйти</span>
            </button>
          </nav>
        </div>

        <div className="sidebar">
          <div className="search-container">
            <svg className="search-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              type="text"
              placeholder="Поиск или добавить @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchLoading && (
              <div className="search-loading">Поиск...</div>
            )}
          </div>

          <div className="contact-list">
            {filteredContacts.length === 0 ? (
              <div className="no-contacts">
                <p>Контакты не найдены</p>
                <p className="hint-text">Введите @username в поле поиска</p>
              </div>
            ) : (
              filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  className={`contact-item ${selectedChat?.id === contact.id ? 'active' : ''}`}
                  onClick={() => setSelectedChat(contact)}
                >
                  <div className="contact-avatar">{contact.username[0].toUpperCase()}</div>
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
              <div className="chat-header">
                <div className="chat-header-info">
                  <div className="chat-avatar">{selectedChat.username[0].toUpperCase()}</div>
                  <div>
                    <h3>{selectedChat.username}</h3>
                    <p className="chat-status">был(а) недавно</p>
                  </div>
                </div>
                <div className="chat-actions">
                  <button className="icon-btn">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                  </button>
                  <button className="icon-btn" onClick={() => setSelectedChat(null)} title="Закрыть чат (ESC)">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="messages-area">
                {currentMessages.length === 0 ? (
                  <div className="empty-chat">
                    <svg viewBox="0 0 24 24" width="80" height="80">
                      <path fill="currentColor" opacity="0.3" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    </svg>
                    <p>История сообщений пуста</p>
                    <span>Отправьте первое сообщение</span>
                  </div>
                ) : (
                  <div className="messages-list">
                    {currentMessages.map((msg, index) => (
                      <div 
                        key={index} 
                        className={`message ${msg.isOutgoing ? 'outgoing' : 'incoming'}`}
                      >
                        <div className="message-bubble">
                          <p>{msg.text}</p>
                          <span className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
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
                <button className="icon-btn" title="Прикрепить файл">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
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
                    <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
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
                      <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </button>
                ) : (
                  <button className="send-btn" title="Голосовое сообщение">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                      <path fill="currentColor" d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    </svg>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg viewBox="0 0 24 24" width="120" height="120">
                  <path fill="currentColor" opacity="0.3" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
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