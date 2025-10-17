const { httpRequestDuration, httpRequestCounter } = require('../config/metrics');

/**
 * Middleware to track HTTP request metrics
 * Records duration and count of HTTP requests by method, route, and status code
 */
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  // Capture the original end function
  const originalEnd = res.end;

  // Override res.end to capture metrics when response is sent
  res.end = function (...args) {
    // Calculate request duration in seconds
    const duration = (Date.now() - start) / 1000;

    // Extract route pattern (or use path if route not available)
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestCounter.labels(method, route, statusCode).inc();

    // Call the original end function
    originalEnd.apply(res, args);
  };

  next();
};

module.exports = metricsMiddleware;
