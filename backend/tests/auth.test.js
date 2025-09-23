const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const User = require('../models/User');
const {
  clearDatabase,
  createTestUser,
  getValidUserData,
  getInvalidUserData,
  getLoginData
} = require('./helpers/dbSetup');
const {
  verifyJWTToken,
  extractTokenFromResponse,
  validateJWTStructure,
  validateTokenExpiration,
  createAuthHeader,
  validateUserResponse
} = require('./helpers/authHelpers');

const corsOptions = require('../config/corsOptions');

let app;

beforeAll(() => {
  app = express();
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(cookieParser());
  app.use('/', express.static(path.join(__dirname, '../public')));
  app.use('/api', require('../routes/userRoutes'));
});

beforeEach(async () => {
  await clearDatabase();
});

describe('Authentication API Tests', () => {

  describe('User Registration - POST /api/users', () => {

    test('should register a new user with valid data', async () => {
      const userData = getValidUserData();

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(validateUserResponse(response.body.user)).toBe(true);
      expect(response.body.user.username).toBe(userData.user.username);
      expect(response.body.user.email).toBe(userData.user.email);
      expect(response.body.user).toHaveProperty('token');

      const dbUser = await User.findOne({ email: userData.user.email });
      expect(dbUser).toBeTruthy();
      expect(dbUser.username).toBe(userData.user.username);

      const passwordMatch = await bcrypt.compare(userData.user.password, dbUser.password);
      expect(passwordMatch).toBe(true);
    });

    test('should generate valid JWT token on registration', async () => {
      const userData = getValidUserData();

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      const token = extractTokenFromResponse(response);
      const decodedToken = verifyJWTToken(token);

      expect(validateJWTStructure(decodedToken)).toBe(true);
      expect(validateTokenExpiration(decodedToken)).toBe(true);
      expect(decodedToken.user.email).toBe(userData.user.email);
    });

    test('should return 400 when required fields are missing', async () => {
      const incompleteData = { user: { username: 'testuser' } };

      const response = await request(app)
        .post('/api/users')
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('All fields are required');
    });

    test('should return 400 when email is missing', async () => {
      const userData = {
        user: {
          username: 'testuser',
          password: 'testpassword123'
        }
      };

      await request(app)
        .post('/api/users')
        .send(userData)
        .expect(400);
    });

    test('should return 400 when username is missing', async () => {
      const userData = {
        user: {
          email: 'test@example.com',
          password: 'testpassword123'
        }
      };

      await request(app)
        .post('/api/users')
        .send(userData)
        .expect(400);
    });

    test('should return 400 when password is missing', async () => {
      const userData = {
        user: {
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      await request(app)
        .post('/api/users')
        .send(userData)
        .expect(400);
    });

    test('should return 422 when user with same email already exists', async () => {
      const existingUser = await createTestUser({
        email: 'existing@example.com',
        username: 'existinguser'
      });

      const userData = {
        user: {
          username: 'newuser',
          email: 'existing@example.com',
          password: 'testpassword123'
        }
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(422);

      expect(response.body).toHaveProperty('errors');
    });

    test('should return 422 when user with same username already exists', async () => {
      const existingUser = await createTestUser({
        email: 'existing@example.com',
        username: 'existinguser'
      });

      const userData = {
        user: {
          username: 'existinguser',
          email: 'new@example.com',
          password: 'testpassword123'
        }
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(422);

      expect(response.body).toHaveProperty('errors');
    });

  });

  describe('User Login - POST /api/users/login', () => {

    let testUser;
    const testPassword = 'testpassword123';

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      testUser = await createTestUser({
        email: 'login@example.com',
        username: 'loginuser',
        password: hashedPassword
      });
    });

    test('should login with valid credentials', async () => {
      const loginData = getLoginData('login@example.com', testPassword);

      const response = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(validateUserResponse(response.body.user)).toBe(true);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.username).toBe(testUser.username);
      expect(response.body.user).toHaveProperty('token');
    });

    test('should generate valid JWT token on login', async () => {
      const loginData = getLoginData('login@example.com', testPassword);

      const response = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(200);

      const token = extractTokenFromResponse(response);
      const decodedToken = verifyJWTToken(token);

      expect(validateJWTStructure(decodedToken)).toBe(true);
      expect(validateTokenExpiration(decodedToken)).toBe(true);
      expect(decodedToken.user.email).toBe(testUser.email);
      expect(decodedToken.user.id).toBe(testUser._id.toString());
    });

    test('should return 404 when user does not exist', async () => {
      const loginData = getLoginData('nonexistent@example.com', testPassword);

      const response = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('User Not Found');
    });

    test('should return 401 when password is incorrect', async () => {
      const loginData = getLoginData('login@example.com', 'wrongpassword');

      const response = await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Unauthorized: Wrong password');
    });

    test('should return 400 when email is missing', async () => {
      const loginData = {
        user: {
          password: testPassword
        }
      };

      await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(400);
    });

    test('should return 400 when password is missing', async () => {
      const loginData = {
        user: {
          email: 'login@example.com'
        }
      };

      await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(400);
    });

    test('should return 400 when user object is missing', async () => {
      const loginData = {};

      await request(app)
        .post('/api/users/login')
        .send(loginData)
        .expect(400);
    });

  });

  describe('JWT Token Validation', () => {

    let testUser;
    let userToken;

    beforeEach(async () => {
      const userData = getValidUserData();

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      userToken = extractTokenFromResponse(response);
      testUser = response.body.user;
    });

    test('should validate JWT token structure', () => {
      const decodedToken = verifyJWTToken(userToken);

      expect(validateJWTStructure(decodedToken)).toBe(true);
      expect(decodedToken.user).toHaveProperty('id');
      expect(decodedToken.user).toHaveProperty('email');
      expect(decodedToken.user).toHaveProperty('password');
      expect(decodedToken).toHaveProperty('exp');
    });

    test('should validate token expiration (1 day)', () => {
      const decodedToken = verifyJWTToken(userToken);
      expect(validateTokenExpiration(decodedToken, 1)).toBe(true);
    });

    test('should contain correct user data in token', () => {
      const decodedToken = verifyJWTToken(userToken);

      expect(decodedToken.user.email).toBe(testUser.email);
      expect(typeof decodedToken.user.id).toBe('string');
      expect(decodedToken.user.id).toMatch(/^[a-f\d]{24}$/i);
    });

    test('should verify token with correct secret', () => {
      expect(() => {
        jwt.verify(userToken, process.env.ACCESS_TOKEN_SECRET);
      }).not.toThrow();
    });

    test('should fail verification with incorrect secret', () => {
      expect(() => {
        jwt.verify(userToken, 'wrong-secret');
      }).toThrow();
    });

    test('should detect expired tokens', () => {
      const expiredToken = jwt.sign(
        { user: { id: 'test', email: 'test@example.com', password: 'hashed' } },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '-1h' }
      );

      expect(() => {
        jwt.verify(expiredToken, process.env.ACCESS_TOKEN_SECRET);
      }).toThrow();
    });

  });

  describe('Protected Route Access', () => {

    let testUser;
    let userToken;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash('testpassword123', 10);
      testUser = await createTestUser({
        email: 'protected@example.com',
        username: 'protecteduser',
        password: hashedPassword
      });
      userToken = testUser.generateAccessToken();
    });

    test('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/user')
        .set('Authorization', createAuthHeader(userToken))
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.username).toBe(testUser.username);
    });

    test('should reject access without authorization header', async () => {
      await request(app)
        .get('/api/user')
        .expect(401);
    });

    test('should reject access with invalid token format', async () => {
      await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401);
    });

    test('should reject access with malformed token', async () => {
      await request(app)
        .get('/api/user')
        .set('Authorization', 'Token invalidtoken')
        .expect(403);
    });

    test('should reject access with expired token', async () => {
      const expiredToken = jwt.sign(
        { user: { id: testUser._id, email: testUser.email, password: testUser.password } },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '-1h' }
      );

      await request(app)
        .get('/api/user')
        .set('Authorization', createAuthHeader(expiredToken))
        .expect(403);
    });

  });

  describe('Error Handling and Edge Cases', () => {

    test('should handle malformed JSON in registration', async () => {
      const response = await request(app)
        .post('/api/users')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    test('should handle malformed JSON in login', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    test('should handle empty request body in registration', async () => {
      await request(app)
        .post('/api/users')
        .send({})
        .expect(400);
    });

    test('should handle empty request body in login', async () => {
      await request(app)
        .post('/api/users/login')
        .send({})
        .expect(400);
    });

    test('should handle invalid email format in registration', async () => {
      const userData = {
        user: {
          username: 'testuser',
          email: 'invalid-email-format',
          password: 'testpassword123'
        }
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(422);

      expect(response.body).toHaveProperty('errors');
    });

  });

});