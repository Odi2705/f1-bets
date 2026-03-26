const router  = require('express').Router();
const { getDb } = require('../db');

// GET /api/events — all events with weekend info
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT e.*, w.name AS weekend_name, w.round, w.season, w.has_sprint, w.location
    FROM events e
    JOIN race_weekends w ON w.id = e.weekend_id
    WHERE w.season = 2025
    ORDER BY w.round, e.type
  `).all();
  res.json(rows);
});

// GET /api/events/participants — list all participants
router.get('/participants', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM participants ORDER BY name').all());
});

// GET /api/events/next — open events (upcoming or allow_late_bets)
router.get('/next', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const events = db.prepare(`
    SELECT e.*, w.name AS weekend_name, w.round, w.season, w.has_sprint, w.location
    FROM events e
    JOIN race_weekends w ON w.id = e.weekend_id
    WHERE w.season = 2025
      AND e.completed = 0
      AND (e.deadline > ? OR e.allow_late_bets = 1)
    ORDER BY w.round, e.type
    LIMIT 6
  `).all(now);
  res.json(events);
});

// GET /api/events/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const event = db.prepare(`
    SELECT e.*, w.name AS weekend_name, w.round, w.season, w.has_sprint, w.location
    FROM events e
    JOIN race_weekends w ON w.id = e.weekend_id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

// GET /api/events/weekend/:weekendId — events for a weekend
router.get('/weekend/:weekendId', (req, res) => {
  const db = getDb();
  const events = db.prepare(`
    SELECT e.*, w.name AS weekend_name, w.round, w.season
    FROM events e
    JOIN race_weekends w ON w.id = e.weekend_id
    WHERE e.weekend_id = ?
    ORDER BY e.type
  `).all(req.params.weekendId);
  res.json(events);
});

module.exports = router;
