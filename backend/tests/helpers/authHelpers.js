const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const verifyJWTToken = (token) => {
  try {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

const extractTokenFromResponse = (response) => {
  if (response.body && response.body.user && response.body.user.token) {
    return response.body.user.token;
  }
  throw new Error('No token found in response');
};

const validateJWTStructure = (decodedToken) => {
  const requiredFields = ['user', 'exp'];
  const userFields = ['id', 'email', 'password'];

  for (const field of requiredFields) {
    if (!decodedToken.hasOwnProperty(field)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!decodedToken.user || typeof decodedToken.user !== 'object') {
    throw new Error('Invalid user object in token');
  }

  for (const field of userFields) {
    if (!decodedToken.user.hasOwnProperty(field)) {
      throw new Error(`Missing required user field: ${field}`);
    }
  }

  return true;
};

const isTokenExpired = (decodedToken) => {
  const currentTime = Math.floor(Date.now() / 1000);
  return decodedToken.exp < currentTime;
};

const validateTokenExpiration = (decodedToken, expectedDurationInDays = 1) => {
  const currentTime = Math.floor(Date.now() / 1000);
  const expectedExpiration = currentTime + (expectedDurationInDays * 24 * 60 * 60);
  const actualExpiration = decodedToken.exp;

  const toleranceInSeconds = 60;
  const difference = Math.abs(actualExpiration - expectedExpiration);

  return difference <= toleranceInSeconds;
};

const createAuthHeader = (token) => {
  return `Token ${token}`;
};

const validateUserResponse = (userResponse) => {
  const requiredFields = ['username', 'email', 'bio', 'image', 'token'];

  for (const field of requiredFields) {
    if (!userResponse.hasOwnProperty(field)) {
      throw new Error(`Missing required field in user response: ${field}`);
    }
  }

  return true;
};

const validatePasswordHash = async (plainPassword, hashedPassword) => {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    throw new Error(`Password validation failed: ${error.message}`);
  }
};

module.exports = {
  verifyJWTToken,
  extractTokenFromResponse,
  validateJWTStructure,
  isTokenExpired,
  validateTokenExpiration,
  createAuthHeader,
  validateUserResponse,
  validatePasswordHash
};