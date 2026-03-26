const router  = require('express').Router();
const { getDb } = require('../db');

// GET /api/standings — season standings (one row per circuit)
router.get('/', (req, res) => {
  const db = getDb();

  const participants = db.prepare('SELECT * FROM participants ORDER BY id').all();
  const weekends = db.prepare(`
    SELECT * FROM race_weekends WHERE season = 2025 ORDER BY round
  `).all();

  // Points per (weekend, participant)
  const pointsRows = db.prepare(`
    SELECT e.weekend_id, b.participant_id,
      SUM(CASE WHEN LOWER(r.driver) = LOWER(b.driver) AND r.position = b.position THEN 1 ELSE 0 END) AS pts
    FROM bets b
    JOIN events e ON e.id = b.event_id AND e.completed = 1
    JOIN results r ON r.event_id = e.id
    GROUP BY e.weekend_id, b.participant_id
  `).all();

  // Build lookup map
  const map = {};
  for (const row of pointsRows) {
    if (!map[row.weekend_id]) map[row.weekend_id] = {};
    map[row.weekend_id][row.participant_id] = row.pts;
  }

  const totals = {};
  participants.forEach(p => { totals[p.id] = 0; });

  const rows = weekends.map(w => {
    const ptsMap = map[w.id] || {};
    const entry = { weekend_id: w.id, name: w.name, round: w.round };
    participants.forEach(p => {
      entry[p.id] = ptsMap[p.id] ?? 0;
      totals[p.id] += entry[p.id];
    });
    return entry;
  });

  res.json({ participants, rows, totals });
});

// GET /api/standings/event/:eventId — comparison table for one event
router.get('/event/:eventId', (req, res) => {
  const db = getDb();
  const eventId = req.params.eventId;

  const event = db.prepare(`
    SELECT e.*, w.name AS weekend_name, w.round, w.season, w.has_sprint, w.location
    FROM events e JOIN race_weekends w ON w.id = e.weekend_id
    WHERE e.id = ?
  `).get(eventId);

  if (!event) return res.status(404).json({ error: 'Event not found' });

  const results = db.prepare(
    'SELECT * FROM results WHERE event_id = ? ORDER BY position'
  ).all(eventId);

  const resultDriverSet = new Set(results.map(r => r.driver.toLowerCase()));
  const resultByPos     = Object.fromEntries(results.map(r => [r.position, r.driver]));

  const participants = db.prepare('SELECT * FROM participants ORDER BY id').all();

  const participantData = participants.map(p => {
    const bets = db.prepare(
      'SELECT * FROM bets WHERE event_id = ? AND participant_id = ? ORDER BY position'
    ).all(eventId, p.id);

    let total = 0;
    const betRows = bets.map(b => {
      const resultAtPos = resultByPos[b.position];
      let status = 'wrong';
      let points = 0;
      if (resultAtPos && resultAtPos.toLowerCase() === b.driver.toLowerCase()) {
        status = 'exact';
        points = 1;
      } else if (resultDriverSet.has(b.driver.toLowerCase())) {
        status = 'other';
      }
      total += points;
      return { position: b.position, driver: b.driver, points, status };
    });

    return { id: p.id, name: p.name, bets: betRows, total };
  });

  res.json({ event, results, participants: participantData });
});

// GET /api/standings/weekend/:weekendId — all events for a weekend
router.get('/weekend/:weekendId', (req, res) => {
  const db = getDb();
  const events = db.prepare(`
    SELECT e.*, w.name AS weekend_name, w.round, w.season
    FROM events e JOIN race_weekends w ON w.id = e.weekend_id
    WHERE e.weekend_id = ? AND e.completed = 1
    ORDER BY e.type
  `).all(req.params.weekendId);
  res.json(events);
});

module.exports = router;
