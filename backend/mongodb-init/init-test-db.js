/* eslint-disable no-undef */
// MongoDB initialization script to create test database
// This script runs when the MongoDB container starts for the first time
// Note: 'db' and 'print' are MongoDB shell globals

print('Creating test database and user permissions...');

// Get environment variables
const rootUser = process.env.MONGO_INITDB_ROOT_USERNAME || 'admin';
const rootPassword = process.env.MONGO_INITDB_ROOT_PASSWORD || 'password123';
const dbName = process.env.MONGO_DB_NAME || 'realworld';
const testDbName = dbName + '_test';

print('Root user: ' + rootUser);
print('Main database: ' + dbName);
print('Test database: ' + testDbName);

// Switch to admin database to authenticate
db = db.getSiblingDB('admin');
db.auth(rootUser, rootPassword);

// Create the test database by inserting a dummy document and then removing it
// This ensures the database exists and permissions are set
db = db.getSiblingDB(testDbName);
db.dummy.insertOne({init: true});
db.dummy.drop();

print('Test database "' + testDbName + '" created successfully');

// Grant the root user permissions on the test database
db = db.getSiblingDB('admin');
db.updateUser(rootUser, {
  roles: [
    { role: 'userAdminAnyDatabase', db: 'admin' },
    { role: 'readWriteAnyDatabase', db: 'admin' },
    { role: 'dbAdminAnyDatabase', db: 'admin' },
    { role: 'clusterAdmin', db: 'admin' },
    { role: 'readWrite', db: dbName },
    { role: 'dbAdmin', db: dbName },
    { role: 'readWrite', db: testDbName },
    { role: 'dbAdmin', db: testDbName }
  ]
});

print('User permissions updated for both main and test databases');
print('Initialization complete!');