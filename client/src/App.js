import React from 'react';
import Login from './Login.js';  // Добавь .js
import './App.css';

function App() {
  return (
    <div className="App">
      <Login onLoginSuccess={(username) => {
        console.log('Logged in as:', username);
      }} />
    </div>
  );
}

export default App;