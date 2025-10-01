import React, { useState, useEffect } from 'react';
import './Login.css';
import fileHelper from './file-helper.js';

const Login = ({ onLoginSuccess, authManager }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [currentLang, setCurrentLang] = useState('ru');
  const [formData, setFormData] = useState({});
  const [keyFile, setKeyFile] = useState(null);
  const [keyFileName, setKeyFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      zeroKnowledge: 'Шифрование без доступа третьих лиц',
      selectKeyFile: 'Выбрать файл ключа',
      keyFileSelected: 'Файл выбран',
      noFileSelected: 'Файл не выбран',
      registering: 'Регистрация...',
      loggingIn: 'Вход...',
      savingKey: 'Сохранение ключа...',
      saveKeyInfo: 'После регистрации откроется окно для сохранения файла ключа'
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
      zeroKnowledge: 'Zero-knowledge encryption',
      selectKeyFile: 'Select Key File',
      keyFileSelected: 'File selected',
      noFileSelected: 'No file selected',
      registering: 'Registering...',
      loggingIn: 'Logging in...',
      savingKey: 'Saving key...',
      saveKeyInfo: 'After registration, a dialog will open to save your key file'
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

  useEffect(() => {
    setError('');
    setSuccess('');
    setKeyFile(null);
    setKeyFileName('');
  }, [isRegister]);

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

  const handleSelectKeyFile = async () => {
    try {
      setError('');
      const fileContent = await fileHelper.loadIdentityFile();
      setKeyFile(fileContent);
      setKeyFileName('✓ ' + t.keyFileSelected);
    } catch (err) {
      if (err.message !== 'Выбор файла отменён' && err.message !== 'Cancelled') {
        setError(err.message);
      }
    }
  };

  const handleLogin = async () => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);

      const username = formData.loginUsername;
      const password = formData.loginPassword;

      if (!username || !password) {
        throw new Error(currentLang === 'ru' ? 'Заполните все поля' : 'Fill in all fields');
      }

      if (!keyFile) {
        throw new Error(currentLang === 'ru' ? 'Выберите файл ключа' : 'Select key file');
      }

      const result = await authManager.login(username, password, keyFile);

      if (result.success) {
        setSuccess(currentLang === 'ru' ? `Добро пожаловать, ${username}!` : `Welcome, ${username}!`);
        setTimeout(() => {
          onLoginSuccess(username);
        }, 1000);
      }
    } catch (err) {
      setError(err.message || (currentLang === 'ru' ? 'Ошибка входа' : 'Login error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);

      const username = formData.registerUsername;
      const password = formData.registerPassword;
      const confirmPassword = formData.registerPasswordConfirm;

      if (!username || !password || !confirmPassword) {
        throw new Error(currentLang === 'ru' ? 'Заполните все поля' : 'Fill in all fields');
      }

      if (password !== confirmPassword) {
        throw new Error(currentLang === 'ru' ? 'Пароли не совпадают!' : 'Passwords do not match!');
      }

      setSuccess(t.registering);

      const result = await authManager.register(username, password);

      if (result.success && result.encryptedKey) {
        setSuccess(t.savingKey);
        
        await fileHelper.saveIdentityFile(username, result.encryptedKey);
        
        setSuccess(currentLang === 'ru' 
          ? `Регистрация успешна! Ключ сохранён` 
          : `Registration successful! Key saved`
        );

        setTimeout(() => {
          onLoginSuccess(username);
        }, 2000);
      }
    } catch (err) {
      setError(err.message || (currentLang === 'ru' ? 'Ошибка регистрации' : 'Registration error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div id="particles" className="particles"></div>

      <div className={`flip-container ${isRegister ? 'flipped' : ''}`}>
        <div className="flipper">
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
                      disabled={loading}
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
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleSelectKeyFile}
                    disabled={loading}
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', marginRight: '8px', fill: 'currentColor' }}>
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                    {t.selectKeyFile}
                  </button>
                  {keyFileName && (
                    <p className="file-status">{keyFileName}</p>
                  )}
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <button 
                  className="btn" 
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading ? t.loggingIn : t.signIn}
                </button>

                <div className="toggle-mode">
                  {t.noAccount} <a onClick={() => !loading && setIsRegister(true)}>{t.createOne}</a>
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
                      disabled={loading}
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
                      disabled={loading}
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
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="info-message">
                  <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', marginRight: '10px', fill: 'currentColor', flexShrink: 0 }}>
                    <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                  </svg>
                  <span>{t.saveKeyInfo}</span>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <button 
                  className="btn" 
                  onClick={handleRegister}
                  disabled={loading}
                >
                  {loading ? t.registering : t.createAccount}
                </button>

                <div className="toggle-mode">
                  {t.haveAccount} <a onClick={() => !loading && setIsRegister(false)}>{t.signInLink}</a>
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