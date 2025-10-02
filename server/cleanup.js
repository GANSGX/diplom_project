require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_app';

async function cleanup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Удаляем все пользователи
    const usersResult = await mongoose.connection.db.collection('users').deleteMany({});
    console.log(`Deleted ${usersResult.deletedCount} users`);

    // Удаляем все сообщения
    const messagesResult = await mongoose.connection.db.collection('messages').deleteMany({});
    console.log(`Deleted ${messagesResult.deletedCount} messages`);

    console.log('Database cleaned successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanup();