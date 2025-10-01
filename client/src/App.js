import React, { useState, useRef } from 'react';
import Login from './Login.js';
import Chat from './Chat.js';
import AuthManager from './auth-manager.js';
import './App.css';

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const authManagerRef = useRef(new AuthManager());

  const handleLoginSuccess = (username) => {
    setLoggedInUser(username);
  };

  const handleLogout = () => {
    authManagerRef.current.logout();
    setLoggedInUser(null);
  };

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