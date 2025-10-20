const promClient = require('prom-client');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default Node.js metrics (CPU, memory, event loop lag, GC, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom Metrics for RealWorld Backend

// HTTP Request Duration Histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// HTTP Request Counter
const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// MongoDB Connection Status Gauge
const mongodbConnectionGauge = new promClient.Gauge({
  name: 'mongodb_connection_status',
  help: 'MongoDB connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

// Active Users Gauge
const activeUsersGauge = new promClient.Gauge({
  name: 'realworld_active_users_total',
  help: 'Total number of registered users',
  registers: [register],
});

// Article Operations Counter
const articleOperationsCounter = new promClient.Counter({
  name: 'realworld_article_operations_total',
  help: 'Total number of article operations',
  labelNames: ['operation'],  // operation: create, update, delete, favorite
  registers: [register],
});

// Comment Operations Counter
const commentOperationsCounter = new promClient.Counter({
  name: 'realworld_comment_operations_total',
  help: 'Total number of comment operations',
  labelNames: ['operation'],  // operation: create, delete
  registers: [register],
});

// Authentication Operations Counter
const authOperationsCounter = new promClient.Counter({
  name: 'realworld_auth_operations_total',
  help: 'Total number of authentication operations',
  labelNames: ['operation', 'status'],  // operation: login, register; status: success, failure
  registers: [register],
});

module.exports = {
  register,
  httpRequestDuration,
  httpRequestCounter,
  mongodbConnectionGauge,
  activeUsersGauge,
  articleOperationsCounter,
  commentOperationsCounter,
  authOperationsCounter,
};
