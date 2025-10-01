const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

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
  sender: { type: String, required: true },
  recipient: { type: String, required: true },
  message: {
    type: { type: Number, required: true },
    body: [Number],
    timestamp: Number,
    ephemeralKey: [Number],
    iv: [Number]
  },
  createdAt: { type: Date, expires: '3d', default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', mongodb: mongoose.connection.readyState });
});

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

app.get('/bundle/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const publicBundle = {
      identityKey: Array.from(user.publicBundle.identityKey),
      registrationId: user.publicBundle.registrationId,
      signedPreKey: {
        keyId: user.publicBundle.signedPreKey.keyId,
        publicKey: Array.from(user.publicBundle.signedPreKey.publicKey),
        signature: Array.from(user.publicBundle.signedPreKey.signature)
      },
      preKeys: user.publicBundle.preKeys.map(pk => ({
        keyId: pk.keyId,
        publicKey: Array.from(pk.publicKey)
      }))
    };
    
    res.json(publicBundle);
  } catch (error) {
    console.error('Bundle fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/send', async (req, res) => {
  const { sender, recipient, message } = req.body;
  if (!recipient || !message) {
    return res.status(400).json({ error: 'Missing recipient or message' });
  }
  try {
    const recipientUser = await User.findOne({ username: recipient });
    if (!recipientUser) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    const msg = new Message({
      sender: sender || 'unknown',
      recipient,
      message: {
        type: message.type,
        body: message.body,
        timestamp: message.timestamp,
        ephemeralKey: message.ephemeralKey,
        iv: message.iv
      }
    });
    await msg.save();
    res.json({ status: 'ok', messageId: msg._id });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ ИСПРАВЛЕНО: возвращаем пустой массив вместо 404
app.get('/fetch/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const messages = await Message.find({ recipient: username });
    
    // Всегда возвращаем массив (пустой или с данными)
    if (!messages.length) {
      return res.json([]);
    }
    
    res.json(messages.map(msg => ({
      messageId: msg._id,
      sender: msg.sender,
      message: msg.message
    })));
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

app.get('/status/:messageId', async (req, res) => {
  const { messageId } = req.params;
  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.json({ status: 'not_found' });
    }
    res.json({ status: 'pending' });
  } catch (error) {
    console.error('Message status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});