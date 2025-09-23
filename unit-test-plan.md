# Unit Test Plan

This document outlines 3 strategic unit tests for the RealWorld multi-container application.

## Test 1: Backend API Authentication Test

**File**: `backend/tests/auth.test.js`

**Purpose**: Test user registration and JWT token generation

**Key Test Cases**:
- User registration with valid data returns JWT token
- User login with correct credentials returns valid token
- Invalid credentials return 401 error
- JWT token can be verified and contains correct user data

**Why Critical**: Authentication is the foundation of the entire application

---

## Test 2: Backend Article CRUD Operations Test

**File**: `backend/tests/articles.test.js`

**Purpose**: Test core article management functionality

**Key Test Cases**:
- Create article with authenticated user succeeds
- Get article by slug returns correct data
- Update article by author succeeds
- Delete article requires proper authorization
- Slug generation works correctly for article titles

**Why Critical**: Articles are the primary content of the RealWorld spec

---

## Test 3: Database Connection & Model Validation Test

**File**: `backend/tests/database.test.js`

**Purpose**: Test MongoDB connection and Mongoose model validation

**Key Test Cases**:
- Database connection establishes successfully
- User model validates required fields (username, email, password)
- Article model enforces required fields and relationships
- Duplicate username/email handling works correctly
- Database cleanup between tests functions properly

**Why Critical**: Ensures data integrity and database connectivity

---

## Test Coverage

These 3 tests provide coverage across:
- **Authentication**: Security layer
- **Business Logic**: Core functionality
- **Data Layer**: Database operations