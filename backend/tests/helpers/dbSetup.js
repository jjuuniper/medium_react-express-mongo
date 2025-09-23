const mongoose = require('mongoose');
const User = require('../../models/User');

const clearDatabase = async () => {
  try {
    await User.deleteMany({});
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
};

const createTestUser = async (userData = {}) => {
  const defaultUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'testpassword123',
    bio: 'Test bio',
    image: 'https://example.com/avatar.jpg'
  };

  const userToCreate = { ...defaultUser, ...userData };

  try {
    const user = new User(userToCreate);
    await user.save();
    return user;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
};

const getValidUserData = () => ({
  user: {
    username: 'newuser',
    email: 'newuser@example.com',
    password: 'validpassword123'
  }
});

const getInvalidUserData = () => ({
  user: {
    username: '',
    email: 'invalid-email',
    password: ''
  }
});

const getLoginData = (email = 'test@example.com', password = 'testpassword123') => ({
  user: {
    email,
    password
  }
});

module.exports = {
  clearDatabase,
  createTestUser,
  getValidUserData,
  getInvalidUserData,
  getLoginData
};