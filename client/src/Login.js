import React, { useState, useEffect } from 'react';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [currentLang, setCurrentLang] = useState('ru');
  const [formData, setFormData] = useState({});

  const translations = {
    ru: {
      subtitle: 'Сквозное шифрование сообщений',
      username: 'Имя пользователя',
      usernamePlaceholder: 'Введите имя пользователя',
      masterPassword: 'Мастер-пароль',
      passwordPlaceholder: 'Введите мастер-пароль',
      signIn: 'Войти',
      noAccount: 'Нет аккаунта?',
      createOne: 'Создать',
      chooseUsername: 'Выберите имя пользователя',
      uniqueUsername: 'Введите уникальное имя',
      createPassword: 'Создайте надёжный пароль',
      confirmPassword: 'Подтвердите пароль',
      reenterPassword: 'Повторите пароль',
      createAccount: 'Создать аккаунт',
      haveAccount: 'Уже есть аккаунт?',
      signInLink: 'Войти',
      zeroKnowledge: 'Шифрование без доступа третьих лиц'
    },
    en: {
      subtitle: 'End-to-end encrypted messaging',
      username: 'Username',
      usernamePlaceholder: 'Enter your username',
      masterPassword: 'Master Password',
      passwordPlaceholder: 'Enter your master password',
      signIn: 'Sign In',
      noAccount: "Don't have an account?",
      createOne: 'Create one',
      chooseUsername: 'Choose Username',
      uniqueUsername: 'Pick a unique username',
      createPassword: 'Create a strong password',
      confirmPassword: 'Confirm Password',
      reenterPassword: 'Re-enter your password',
      createAccount: 'Create Account',
      haveAccount: 'Already have an account?',
      signInLink: 'Sign in',
      zeroKnowledge: 'Zero-knowledge encryption'
    }
  };

  const t = translations[currentLang];

  useEffect(() => {
    const container = document.getElementById('particles');
    if (container) {
      container.innerHTML = '';
      for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 15 + 's';
        particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
        container.appendChild(particle);
      }
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    const wrapper = e.target.closest('.input-wrapper');
    if (value.length > 0) {
      wrapper?.classList.add('filled');
    } else {
      wrapper?.classList.remove('filled');
    }
  };

  const handleLogin = () => {
    console.log('Login:', formData);
    // TODO: Подключить AuthManager
  };

  const handleRegister = () => {
    if (formData.registerPassword !== formData.registerPasswordConfirm) {
      alert(currentLang === 'ru' ? 'Пароли не совпадают!' : 'Passwords do not match!');
      return;
    }
    console.log('Register:', formData);
    // TODO: Подключить AuthManager
  };

  return (
    <div className="login-page">
      <div id="particles" className="particles"></div>

      <div className={`flip-container ${isRegister ? 'flipped' : ''}`}>
        <div className="flipper">
          {/* Передняя сторона - Login */}
          <div className="card-face card-front">
            <div className="auth-card">
              <div className="lang-switcher">
                <button 
                  className={`lang-btn ${currentLang === 'ru' ? 'active' : ''}`}
                  onClick={() => setCurrentLang('ru')}
                >
                  RU
                </button>
                <button 
                  className={`lang-btn ${currentLang === 'en' ? 'active' : ''}`}
                  onClick={() => setCurrentLang('en')}
                >
                  EN
                </button>
              </div>

              <div className="logo">
                <div className="logo-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                  </svg>
                </div>
                <h1>CryptoX</h1>
                <p className="subtitle">{t.subtitle}</p>
              </div>

              <div>
                <div className="form-group">
                  <label>{t.username}</label>
                  <div className="input-wrapper">
                    <input 
                      type="text" 
                      name="loginUsername"
                      placeholder={t.usernamePlaceholder}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t.masterPassword}</label>
                  <div className="input-wrapper">
                    <input 
                      type="password" 
                      name="loginPassword"
                      placeholder={t.passwordPlaceholder}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <button className="btn" onClick={handleLogin}>{t.signIn}</button>

                <div className="toggle-mode">
                  {t.noAccount} <a onClick={() => setIsRegister(true)}>{t.createOne}</a>
                </div>
              </div>

              <div className="security-badge">
                <svg viewBox="0 0 24 24">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
                </svg>
                <span>{t.zeroKnowledge}</span>
              </div>
            </div>
          </div>

          {/* Задняя сторона - Register */}
          <div className="card-face card-back">
            <div className="auth-card">
              <div className="lang-switcher">
                <button 
                  className={`lang-btn ${currentLang === 'ru' ? 'active' : ''}`}
                  onClick={() => setCurrentLang('ru')}
                >
                  RU
                </button>
                <button 
                  className={`lang-btn ${currentLang === 'en' ? 'active' : ''}`}
                  onClick={() => setCurrentLang('en')}
                >
                  EN
                </button>
              </div>

              <div className="logo">
                <div className="logo-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                  </svg>
                </div>
                <h1>CryptoX</h1>
                <p className="subtitle">{t.subtitle}</p>
              </div>

              <div>
                <div className="form-group">
                  <label>{t.chooseUsername}</label>
                  <div className="input-wrapper">
                    <input 
                      type="text" 
                      name="registerUsername"
                      placeholder={t.uniqueUsername}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t.masterPassword}</label>
                  <div className="input-wrapper">
                    <input 
                      type="password" 
                      name="registerPassword"
                      placeholder={t.createPassword}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t.confirmPassword}</label>
                  <div className="input-wrapper">
                    <input 
                      type="password" 
                      name="registerPasswordConfirm"
                      placeholder={t.reenterPassword}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <button className="btn" onClick={handleRegister}>{t.createAccount}</button>

                <div className="toggle-mode">
                  {t.haveAccount} <a onClick={() => setIsRegister(false)}>{t.signInLink}</a>
                </div>
              </div>

              <div className="security-badge">
                <svg viewBox="0 0 24 24">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
                </svg>
                <span>{t.zeroKnowledge}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;