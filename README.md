# CryptoX — Secure Messenger

**Мессенджер с максимальной защитой данных, нулевым доверием к серверу и полным контролем над приватностью**

---

## Проблема и решение

### Проблема современных мессенджеров

Даже популярные "защищённые" мессенджеры имеют критические уязвимости:

- **Сбор метаданных**: кто, кому, когда, как часто пишет  
- **Серверный доступ**: компании имеют техническую возможность читать сообщения  
- **Привязка к личности**: телефон, email, геолокация  
- **Централизованное хранение ключей**: единая точка отказа  
- **Журналы активности**: история действий хранится годами  

### Решение CryptoX

**CryptoX** реализует концепцию **Zero-Knowledge Architecture** (архитектура нулевого знания):

- Сервер **физически не может** прочитать сообщения  
- Ключи шифрования **никогда не покидают** устройство пользователя  
- Метаданные сведены к **абсолютному минимуму**  
- Сообщения удаляются **автоматически после доставки**  
- Полная **анонимность** без привязки к личным данным  

---

## Архитектура безопасности

### 1. Криптография военного уровня

#### Шифрование сообщений
- **Алгоритм**: AES-GCM-256 (Advanced Encryption Standard, режим Galois/Counter Mode)  
- **Длина ключа**: 256 бит (практически невзламываем брутфорсом)  
- **Аутентификация**: встроенная проверка целостности (GMAC tag)  
- **IV (Initialization Vector)**: уникальный для каждого сообщения (96 бит случайных данных)  

#### Обмен ключами
- **Протокол**: ECDH (Elliptic Curve Diffie-Hellman)  
- **Кривая**: P-256 (NIST стандарт, 128-bit эквивалент безопасности)  
- **Ephemeral keys**: временные ключи для каждого сообщения (**Perfect Forward Secrecy**)  
- **Принцип**: даже при компрометации долгосрочного ключа старые сообщения остаются защищены  

#### Защита мастер-пароля
- **Алгоритм**: PBKDF2 (Password-Based Key Derivation Function 2)  
- **Хеш-функция**: SHA-256  
- **Итерации**: 200,000 (защита от брутфорса)  
- **Соль**: уникальная для каждого пользователя  

### 2. Что сервер НЕ знает

**Сервер НЕ имеет доступа к:**
- Содержимому сообщений (зашифровано AES-256)  
- Приватным ключам пользователей (хранятся локально)  
- Мастер-паролям (не передаются на сервер)  
- Истории переписок (сообщения удаляются после доставки)  
- Метаданным активности (нет журналов)  
- IP-адресам и геолокации (не логируются)  

**Сервер получает только:**
- Username получателя  
- Зашифрованный массив байтов сообщения  
- Публичный временный ключ (ephemeral key)  
- Вектор инициализации (IV)  
- Временную метку  

### 3. Минимизация метаданных

**Что хранится на сервере:**
- Публичный ключ пользователя (identityKey)  
- Registration ID  
- Signed PreKey (для установки сессии)  
- Список PreKeys  

**TTL (Time To Live) сообщений:**
- Автоматическое удаление через 3 дня  
- Немедленное удаление после подтверждения доставки (**ACK**)  
- MongoDB TTL Index обеспечивает гарантированное удаление  

### 4. Локальное хранение

**Файл ключа (.enc):**
- Приватный ключ зашифрован AES-256  
- Вектор инициализации (IV)  
- Соль для PBKDF2  
- Тип файла (simple-identity)  

**IndexedDB (дополнительное хранилище):**
- **Шифрование**: AES-GCM-256 с мастер-ключом  
- **user_data**: зашифрованный identity  
- **contacts**: публичные ключи собеседников  
- **messages**: локальная история переписок  

---

## Технические особенности

### Backend Architecture

**REST API Endpoints:**
- `POST /register` — регистрация нового пользователя  
- `GET /bundle/:username` — получение публичного ключа  
- `POST /send` — отправка зашифрованного сообщения  
- `GET /fetch/:username` — получение сообщений  
- `POST /ack` — подтверждение получения  
- `GET /status/:messageId` — проверка статуса сообщения  

**MongoDB Collections:**
- **users** — username (unique), publicBundle (identity)  
- **messages** — recipient, message (encrypted), createdAt (TTL: 3 days)  

### Crypto Flow

**Отправка сообщения:**
1. Alice генерирует ECDH ephemeral key  
2. Создаёт общий секрет через ECDH с публичным ключом Bob  
3. Шифрует сообщение AES-GCM-256  
4. Отправляет зашифрованное сообщение + ephemeral key на сервер  
5. Сервер хранит зашифрованное сообщение (не может прочитать)  
6. Bob запрашивает сообщения  
7. Сервер возвращает зашифрованное сообщение  
8. Bob создаёт общий секрет через ECDH  
9. Расшифровывает сообщение AES-GCM-256  
10. Отправляет **ACK** подтверждение  
11. Сервер удаляет сообщение навсегда  

---

## Текущий статус разработки

### Реализовано (v0.2.0)

**Безопасность:**
- ECDH key exchange (P-256)  
- AES-GCM-256 шифрование  
- PBKDF2 защита паролей (200k итераций)  
- Локальное хранение ключей в `.enc` файлах  
- IndexedDB с шифрованием  
- Ephemeral keys для **Perfect Forward Secrecy**  
- Автоудаление сообщений (TTL)  

**UI/UX:**
- Авторизация/регистрация с flip-анимацией  
- Выбор файла ключа через системный диалог  
- Мультиязычность (RU/EN)  
- Валидация форм  
- Уведомления об ошибках/успехе  
- Адаптивный дизайн  

**Backend:**
- REST API (Express)  
- MongoDB Atlas интеграция  
- Endpoints: register, bundle, send, fetch, ack, status  
- TTL для автоудаления  
- CORS настройка  

**Инфраструктура:**
- Electron desktop app  
- Веб-версия  
- ES6 модули  
- Кроссплатформенная работа с файлами  

### В разработке (v0.3.0)

- Главный экран чата  
- Список контактов  
- UI окна переписки  
- Реальная отправка/получение сообщений  
- Уведомления о новых сообщениях  
- Статусы доставки  

### Roadmap (v1.0.0+)

**Функционал:**
- Полноценный Signal Protocol  
- Групповые чаты  
- Отправка файлов  
- Голосовые сообщения  
- Самоуничтожающиеся сообщения  
- Двухфакторная аутентификация  

**Продвинутые функции:**
- Видеозвонки (WebRTC P2P)  
- Голосовые звонки  
- Sharing экрана  
- Верификация контактов (QR-коды)  
- Защита от спама  

**Платформы:**
- iOS приложение  
- Android приложение  
- Linux ARM поддержка  
- Progressive Web App  

---

## Безопасность и ограничения

### Текущие гарантии безопасности
- **Конфиденциальность сообщений**: сервер не может их прочитать  
- **Целостность данных**: GMAC tag проверяет подлинность  
- **Forward Secrecy**: компрометация ключа не раскрывает старые сообщения  
- **Анонимность**: нет привязки к личным данным  
- **Минимум метаданных**: только recipient и timestamp  

### Известные ограничения
- Упрощённая криптография: текущая версия не использует полноценный Signal Protocol  
- Нет аудита: код не проходил профессиональный security audit  
- Метаданные времени: timestamp сообщений виден серверу  
- Нет защиты от traffic analysis: размер сообщений не маскируется  
- Браузерная версия: менее защищена чем Electron  

### Рекомендации по использованию
Для максимальной безопасности:
- Используйте **Electron версию** (не браузер)  
- Храните `.enc` файлы на зашифрованном диске  
- Используйте сложный мастер-пароль (15+ символов)  
- Не используйте один пароль для всех сервисов  
- Регулярно обновляйте приложение  

**НЕ используйте для:**
- Критически важной информации (пока нет аудита)  
- Корпоративной переписки (требуется compliance)  
- Обмена государственными секретами  
- Медицинских данных (требуется HIPAA)  

---

## Вклад в проект

**Как помочь:**
- Найти и сообщить о багах через Issues  
- Предложить улучшения  
- Отправить Pull Request  
- Улучшить документацию  
- Добавить переводы  
- Провести аудит безопасности  

**Guidelines:**
1. Fork репозиторий  
2. Создай feature branch  
3. Commit изменения  
4. Push в branch  
5. Открой Pull Request  

---

## Лицензия

Распространяется под **MIT License**. Свободное использование, модификация и распространение с сохранением копирайта.  

---

## Disclaimer

**ВАЖНО**: Это дипломный/учебный проект в стадии активной разработки.  

Текущая версия **НЕ прошла**:
- Профессиональный security audit  
- Нагрузочное тестирование  
- Penetration testing  
- Compliance сертификацию  

**НЕ РЕКОМЕНДУЕТСЯ** использовать для обмена критически важной информацией до завершения полного аудита безопасности и достижения версии `v1.0.0`.  

---

## Контакты

- Разработчик: **GANSGX**  
- GitHub: [github.com/GANSGX](https://github.com/GANSGX)  
- Проект: [github.com/GANSGX/diplom_project](https://github.com/GANSGX/diplom_project)  
- Баг-репорты: **Issues**  

---

## Changelog

### v0.2.0 (2025-10-01) — Current
**Added:**
- Complete login/registration UI with flip-animation  
- File operations for key import/export  
- Electron IPC handlers for file dialogs  
- State clearing on card flip  
- Multilingual support improvements  

**Changed:**
- Refactored crypto modules to ES6  
- Improved error messages styling  
- Updated README with technical details  

### v0.1.3 (2025-09-30)
**Added:**
- Initial UI for login and registration forms  
- Message send/receive methods with ECDH encryption  
- Server schema updates for ephemeralKey and iv  

**Fixed:**
- ES Modules compatibility for Electron and React  

### v0.1.2 (2025-09-30)
**Added:**
- AuthManager with register, login, searchUser methods  
- CORS support for cross-origin requests  

**Fixed:**
- MongoDB connection warnings  

### v0.1.1 (2025-09-29)
**Added:**
- Secure message delivery with TTL (3 days auto-delete)  
- Server setup with MongoDB Atlas  
- Endpoints: /register, /bundle, /send, /fetch, /ack, /status  

### v0.1.0 (2025-09-28)
**Added:**
- Encrypted IndexedDB storage for keys and messages  
- Signal Protocol implementation (simplified)  
- Key export/import with password protection  
- ECDSA/ECDH key generation and management  

### v0.0.2 (2025-09-28)
**Added:**
- Express server setup  
- React + Electron client setup  
- Project structure  

### v0.0.1 (2025-09-28)
**Initial commit:**
- Repository creation  
- Basic project scaffold  

---

> "Arguing that you don’t care about the right to privacy because you have nothing to hide is no different than saying you don’t care about free speech because you have nothing to say."  
> — Edward Snowden
