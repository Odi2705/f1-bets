const router = require('express').Router();
const { getDb } = require('../db');
const { fetchQualifyingResults, fetchRaceResults, fetchSprintResults } = require('../services/f1api');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'f1bets2025';

function auth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// GET /api/admin/weekends — list all weekends
router.get('/weekends', auth, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT w.*,
      (SELECT COUNT(*) FROM events e WHERE e.weekend_id = w.id AND e.completed = 1) AS completed_events,
      (SELECT COUNT(*) FROM events e WHERE e.weekend_id = w.id) AS total_events
    FROM race_weekends w
    WHERE w.season = 2025
    ORDER BY w.round
  `).all();
  res.json(rows);
});

// POST /api/admin/fetch-results/:eventId — auto-fetch from F1 API
router.post('/fetch-results/:eventId', auth, async (req, res) => {
  const db = getDb();
  const event = db.prepare(`
    SELECT e.*, w.round, w.season FROM events e
    JOIN race_weekends w ON w.id = e.weekend_id WHERE e.id = ?
  `).get(req.params.eventId);

  if (!event) return res.status(404).json({ error: 'Event not found' });

  try {
    let results;
    if (event.type === 'qualify') {
      results = await fetchQualifyingResults(event.season, event.round);
    } else if (event.type === 'race') {
      results = await fetchRaceResults(event.season, event.round);
    } else if (event.type === 'sprint') {
      results = await fetchSprintResults(event.season, event.round);
    }

    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'Resultados não encontrados na API' });
    }

    const insert = db.prepare(
      'INSERT OR REPLACE INTO results (event_id, position, driver) VALUES (?, ?, ?)'
    );
    const markDone = db.prepare('UPDATE events SET completed = 1 WHERE id = ?');

    const save = db.transaction(() => {
      for (const r of results) insert.run(event.id, r.position, r.driver);
      markDone.run(event.id);
    });
    save();

    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/set-results/:eventId — manually enter results
// Body: { results: [{position, driver}] }
router.post('/set-results/:eventId', auth, (req, res) => {
  const db = getDb();
  const { results } = req.body;

  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'Resultados inválidos' });
  }

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const insert = db.prepare(
    'INSERT OR REPLACE INTO results (event_id, position, driver) VALUES (?, ?, ?)'
  );
  const markDone = db.prepare('UPDATE events SET completed = 1 WHERE id = ?');

  const save = db.transaction(() => {
    for (const r of results) insert.run(event.id, r.position, r.driver);
    markDone.run(event.id);
  });
  save();

  res.json({ ok: true });
});

// PUT /api/admin/events/:id/reopen — reopen betting for an event
router.put('/events/:id/reopen', auth, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE events SET allow_late_bets = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/admin/events/:id/close — close betting for an event
router.put('/events/:id/close', auth, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE events SET allow_late_bets = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/admin/events/:id/uncomplete — undo completion (clear results)
router.put('/events/:id/uncomplete', auth, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE events SET completed = 0 WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM results WHERE event_id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
