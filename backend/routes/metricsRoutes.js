const express = require('express');
const router = express.Router();
const { register } = require('../config/metrics');

/**
 * GET /metrics
 * Prometheus metrics endpoint
 * Returns all registered metrics in Prometheus format
 */
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).end(err);
  }
});

module.exports = router;
