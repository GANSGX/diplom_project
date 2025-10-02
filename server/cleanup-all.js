require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_app';

async function cleanupAll() {
  try {
    console.log('Подключение к MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Подключено к MongoDB');

    // Удаляем всех пользователей
    const usersResult = await mongoose.connection.db.collection('users').deleteMany({});
    console.log(`✅ Удалено пользователей: ${usersResult.deletedCount}`);

    // Удаляем все сообщения
    const messagesResult = await mongoose.connection.db.collection('messages').deleteMany({});
    console.log(`✅ Удалено сообщений: ${messagesResult.deletedCount}`);

    console.log('\n🎉 База данных полностью очищена!');
    console.log('\nТеперь в браузере/Electron выполни:');
    console.log('  1. Открой DevTools (F12)');
    console.log('  2. Вкладка Console');
    console.log('  3. Выполни: indexedDB.deleteDatabase("SecureMessengerDB")');
    console.log('  4. Перезагрузи страницу');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

cleanupAll();