require('dotenv').config();
const mongoose = require('mongoose');

beforeAll(async () => {
  try {
    const username = process.env.MONGO_ROOT_USERNAME || 'admin';
    const password = process.env.MONGO_ROOT_PASSWORD || 'password123';
    const dbName = process.env.MONGO_DB_NAME || 'realworld';
    const mongoHost = process.env.MONGO_HOST || 'mongodb';

    console.log('MongoDB credentials:', { username, dbName, host: mongoHost });
    console.log('Password length:', password.length);

    const mongoUri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${mongoHost}:27017/${dbName}_test?authSource=admin`;

    console.log('Connecting to test database...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to test database:', mongoose.connection.name);
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  } catch (error) {
    console.error('Test teardown failed:', error);
  }
});

afterEach(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
      }
    }
  } catch (error) {
    console.error('Test cleanup failed:', error);
  }
});