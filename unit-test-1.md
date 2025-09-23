# Unit Test 1: Backend API Authentication Test - Implementation Plan

## Purpose
Implement comprehensive authentication testing for the RealWorld backend API, covering user registration, login, and JWT token validation.

## 1. Codebase Analysis Summary

### Current Authentication Architecture
- **Registration Endpoint**: `POST /api/users` (public)
- **Login Endpoint**: `POST /api/users/login` (public)
- **Protected Routes**: Use `verifyJWT` middleware
- **JWT Format**: `Authorization: Token <jwt_token>`

### Key Files and Responsibilities
- **`controllers/usersController.js`**:
  - `registerUser()`: Creates new user with bcrypt hashed password
  - `userLogin()`: Validates credentials and returns JWT token
- **`models/User.js`**:
  - User schema with validation
  - `generateAccessToken()`: Creates JWT with user data
  - `toUserResponse()`: Returns user object with token
- **`middleware/verifyJWT.js`**:
  - Validates JWT tokens on protected routes
  - Extracts user data from token payload
- **`routes/userRoutes.js`**:
  - Route definitions for authentication endpoints

### JWT Token Structure
```javascript
{
  "user": {
    "id": "<user_id>",
    "email": "<user_email>",
    "password": "<hashed_password>"
  },
  "exp": "<expiration_timestamp>"
}
```

## 2. Test Framework Setup

### Container-Based Testing Approach
This implementation uses **Option 2: Dedicated Test Container** to keep testing dependencies separate from the backend application container.

### Required npm Packages
Test dependencies will be installed in the dedicated test container, not in the main backend container.

### Docker Compose Test Service Configuration
Add a dedicated test service to `docker-compose.dev.yml`:
```yaml
# Add this service to docker-compose.dev.yml
test:
  build:
    context: ./backend
    dockerfile: Dockerfile
    target: development
  container_name: realworld-test
  environment:
    NODE_ENV: test
    ACCESS_TOKEN_SECRET: ${ACCESS_TOKEN_SECRET_TEST:-test-secret-key-for-testing}
    DATABASE_URI: mongodb://${MONGO_ROOT_USERNAME:-admin}:${MONGO_ROOT_PASSWORD:-password123}@mongodb:27017/${MONGO_DB_NAME:-realworld}_test?authSource=admin
  volumes:
    - ./backend:/app
    - /app/node_modules
  networks:
    - realworld-network-dev
  depends_on:
    - mongodb
  profiles:
    - test
  command: ["npm", "test"]
```

**⚠️ Security Note**: The configuration above uses environment variables to avoid hardcoding secrets. Update your `.env` file to include:
```bash
# Add these test-specific variables to .env (DO NOT commit real secrets)
ACCESS_TOKEN_SECRET_TEST=your-test-jwt-secret-different-from-production
```

### Package.json Script Update
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "setupFilesAfterEnv": ["<rootDir>/tests/setup.js"]
  }
}
```

### Test Environment Configuration
- Uses dedicated test container separate from backend application
- Connects to existing MongoDB container with test database (`realworld_test`)
- Set `NODE_ENV=test` during testing
- Uses separate JWT secret for testing (stored in environment variables, not hardcoded)
- Test dependencies isolated from production backend container
- **Security**: All secrets managed via environment variables, never hardcoded in configuration files

## 3. Test Implementation Details

### Test File Structure: `backend/tests/auth.test.js`

#### Test Cases to Implement

**User Registration Tests**:
1. **Valid Registration**: Verify user creation with valid data returns 201 status and JWT token
2. **Missing Fields**: Test 400 error when email, username, or password is missing
3. **Duplicate User**: Test 422 error when username or email already exists
4. **Token Generation**: Verify JWT token is included in response and is valid

**User Login Tests**:
1. **Valid Login**: Verify login with correct credentials returns 200 status and JWT token
2. **Invalid Email**: Test 404 error when user doesn't exist
3. **Wrong Password**: Test 401 error when password is incorrect
4. **Missing Credentials**: Test 400 error when email or password is missing

**JWT Token Validation Tests**:
1. **Token Structure**: Verify JWT contains correct user data (id, email, password)
2. **Token Expiration**: Verify token has 1-day expiration
3. **Token Verification**: Test that generated token can be verified with ACCESS_TOKEN_SECRET
4. **Protected Route Access**: Test that valid token allows access to protected endpoints

### Sample Test Data
```javascript
const validUser = {
  user: {
    username: "testuser",
    email: "test@example.com",
    password: "testpassword123"
  }
};

const invalidUser = {
  user: {
    username: "",
    email: "invalid-email",
    password: ""
  }
};
```

### Test Assertions
- HTTP status codes (200, 201, 400, 401, 404, 422)
- Response body structure validation
- JWT token presence and validity
- User data accuracy in responses
- Password hashing verification
- Database state verification

## 4. Integration Requirements

### Environment Variables for Testing
```bash
# Add to .env file (DO NOT commit real secrets to version control)
ACCESS_TOKEN_SECRET_TEST=generate-a-secure-random-key-for-testing
NODE_ENV=test

# Database URI uses existing environment variables for security
# DATABASE_URI is constructed from MONGO_ROOT_USERNAME, MONGO_ROOT_PASSWORD, etc.
```

**🔒 Security Best Practices:**
- Use separate JWT secrets for testing vs production
- Never hardcode secrets in docker-compose files
- Use environment variable substitution: `${VARIABLE_NAME:-default}`
- Add `.env` to `.gitignore` to prevent committing secrets
- Use strong, randomly generated secrets even for testing

### Database Setup
- Use MongoDB Memory Server for isolated testing
- Create fresh database for each test suite
- Clean up users collection between tests
- Seed test data as needed

### File Structure
```
backend/
├── tests/
│   ├── setup.js           # Test environment setup
│   ├── auth.test.js       # Authentication tests
│   └── helpers/
│       ├── dbSetup.js     # Database utilities
│       └── authHelpers.js # Authentication test helpers
├── package.json           # Updated with test scripts and test dependencies
└── jest.config.js         # Jest configuration

# Docker configuration
docker-compose.dev.yml     # Updated with test service
```

## 5. Implementation Checklist

### Step 1: Setup Dedicated Test Container
- [ ] Add test service configuration to `docker-compose.dev.yml`
- [ ] Update backend `package.json` with test dependencies:
  ```json
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.3.0",
    "mongodb-memory-server": "^8.12.0",
    "nodemon": "^2.0.20"
  }
  ```
- [ ] Configure Jest in package.json

### Step 2: Create Test Infrastructure
- [ ] Create test directories in backend:
  ```
  backend/tests/
  backend/tests/helpers/
  ```
- [ ] Create `tests/setup.js` for global test setup
- [ ] Create `tests/helpers/dbSetup.js` for database utilities
- [ ] Configure Jest to use test environment

### Step 3: Implement Authentication Tests
- [ ] Create `tests/auth.test.js` with all test cases
- [ ] Implement user registration tests
- [ ] Implement user login tests
- [ ] Implement JWT token validation tests

### Step 4: Test Database Integration
- [ ] Configure test container to connect to MongoDB container
- [ ] Implement database cleanup between tests using test database
- [ ] Verify User model works in test environment

### Step 5: Validation and Verification
- [ ] Run tests using dedicated test container:
  ```bash
  docker-compose --profile test -f docker-compose.dev.yml run test
  ```
- [ ] Verify tests work with existing codebase
- [ ] Check test coverage for authentication flow
- [ ] Validate JWT token functionality

### Step 6: Edge Cases and Error Handling
- [ ] Test malformed requests
- [ ] Test database connection errors
- [ ] Test JWT verification edge cases
- [ ] Verify proper error responses

### Running Tests
```bash
# Run all tests with dedicated test container
docker-compose --profile test -f docker-compose.dev.yml run test

# Run tests with coverage
docker-compose --profile test -f docker-compose.dev.yml run test npm run test:coverage

# Run tests in watch mode (for development)
docker-compose --profile test -f docker-compose.dev.yml run test npm run test:watch

# Clean up test containers
docker-compose --profile test -f docker-compose.dev.yml down
```

## Key Testing Considerations

### What to Test
- Complete user registration flow
- User login authentication
- JWT token generation and validation
- Error handling for all failure scenarios
- Integration with existing User model and middleware

### What NOT to Test
- Bcrypt internal hashing (already tested by bcrypt library)
- JWT library functionality (already tested by jsonwebtoken library)
- MongoDB connection (tested separately)
- Express framework functionality

### Success Criteria
- All authentication endpoints tested
- 100% coverage of authentication controller functions
- JWT token validation working correctly
- Error scenarios properly handled
- Tests run in isolation without affecting other components
- Test dependencies isolated from production backend container