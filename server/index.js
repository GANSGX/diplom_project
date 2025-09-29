const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_app';

// Схема User
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  publicBundle: {
    identityKey: Buffer,
    registrationId: Number,
    signedPreKey: {
      keyId: Number,
      publicKey: Buffer,
      signature: Buffer
    },
    preKeys: [{ keyId: Number, publicKey: Buffer }]
  }
});
const User = mongoose.model('User', userSchema);

// Схема Message
const messageSchema = new mongoose.Schema({
  recipient: { type: String, required: true },
  message: {
    type: { type: Number, required: true },
    body: [Number],
    timestamp: Number
  },
  createdAt: { type: Date, expires: '30d', default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', mongodb: mongoose.connection.readyState });
});

// Регистрация
app.post('/register', async (req, res) => {
  const { username, publicBundle } = req.body;
  if (!username || !publicBundle) {
    return res.status(400).json({ error: 'Missing username or publicBundle' });
  }
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const user = new User({
      username,
      publicBundle: {
        identityKey: Buffer.from(publicBundle.identityKey),
        registrationId: publicBundle.registrationId,
        signedPreKey: {
          keyId: publicBundle.signedPreKey.keyId,
          publicKey: Buffer.from(publicBundle.signedPreKey.publicKey),
          signature: Buffer.from(publicBundle.signedPreKey.signature)
        },
        preKeys: publicBundle.preKeys.map(preKey => ({
          keyId: preKey.keyId,
          publicKey: Buffer.from(preKey.publicKey)
        }))
      }
    });
    await user.save();
    res.json({ status: 'ok', username });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение публичного bundle
app.get('/bundle/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.publicBundle);
  } catch (error) {
    console.error('Bundle fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Отправка сообщения
app.post('/send', async (req, res) => {
  const { recipient, message } = req.body;
  if (!recipient || !message) {
    return res.status(400).json({ error: 'Missing recipient or message' });
  }
  try {
    const recipientUser = await User.findOne({ username: recipient });
    if (!recipientUser) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    const msg = new Message({
      recipient,
      message: {
        type: message.type,
        body: message.body,
        timestamp: message.timestamp
      }
    });
    await msg.save();
    res.json({ status: 'ok', messageId: msg._id });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение сообщений
app.get('/fetch/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const messages = await Message.find({ recipient: username });
    if (!messages.length) {
      return res.status(404).json({ error: 'No messages found' });
    }
    res.json(messages.map(msg => ({
      messageId: msg._id,
      message: msg.message
    })));
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Подтверждение доставки
app.post('/ack', async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) {
    return res.status(400).json({ error: 'Missing messageId' });
  }
  try {
    const message = await Message.findByIdAndDelete(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json({ status: 'ok', messageId });
  } catch (error) {
    console.error('Acknowledge message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});