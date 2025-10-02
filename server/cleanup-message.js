// В mongo shell или создай скрипт cleanup-messages.js в папке server
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function cleanupMessages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.db.collection('messages').deleteMany({});
    console.log(`Deleted ${result.deletedCount} old messages`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupMessages();