import React, { useState, useRef, useEffect } from 'react';
import Login from './Login.js';
import Chat from './Chat.js';
import AuthManager from './auth-manager.js';
import './App.css';

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const authManagerRef = useRef(new AuthManager());

  // Восстановление сессии при загрузке
  useEffect(() => {
    const restoreSession = async () => {
      const username = await authManagerRef.current.restoreSession();
      if (username) {
        setLoggedInUser(username);
      }
      setRestoring(false);
    };
    
    restoreSession();
  }, []);

  const handleLoginSuccess = (username) => {
    setLoggedInUser(username);
  };

  const handleLogout = () => {
    authManagerRef.current.logout();
    setLoggedInUser(null);
  };

  if (restoring) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
        color: '#f0f6fc'
      }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div className="App">
      {loggedInUser ? (
        <Chat 
          username={loggedInUser} 
          onLogout={handleLogout}
          authManager={authManagerRef.current}
        />
      ) : (
        <Login 
          onLoginSuccess={handleLoginSuccess}
          authManager={authManagerRef.current}
        />
      )}
    </div>
  );
}

export default App;