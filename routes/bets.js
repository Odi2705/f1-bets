const router  = require('express').Router();
const { getDb } = require('../db');

// GET /api/bets/event/:eventId — all bets for an event grouped by participant
router.get('/event/:eventId', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT b.*, p.name AS participant_name
    FROM bets b
    JOIN participants p ON p.id = b.participant_id
    WHERE b.event_id = ?
    ORDER BY p.name, b.position
  `).all(req.params.eventId);
  res.json(rows);
});

// GET /api/bets/event/:eventId/participant/:participantId
router.get('/event/:eventId/participant/:participantId', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM bets
    WHERE event_id = ? AND participant_id = ?
    ORDER BY position
  `).all(req.params.eventId, req.params.participantId);
  res.json(rows);
});

// POST /api/bets — submit/update bets
// Body: { participant_id, event_id, bets: [{position, driver}] }
router.post('/', (req, res) => {
  const db = getDb();
  const { participant_id, event_id, bets } = req.body;

  if (!participant_id || !event_id || !Array.isArray(bets) || bets.length === 0) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const event = db.prepare(`
    SELECT e.*, w.round, w.season FROM events e
    JOIN race_weekends w ON w.id = e.weekend_id
    WHERE e.id = ?
  `).get(event_id);

  if (!event) return res.status(404).json({ error: 'Event not found' });

  const now = new Date().toISOString();
  if (event.allow_late_bets === 0 && now > event.deadline) {
    return res.status(403).json({ error: 'Prazo encerrado para esta etapa' });
  }

  const maxPos = event.type === 'race' ? 10 : 3;
  for (const { position, driver } of bets) {
    if (!Number.isInteger(position) || position < 1 || position > maxPos) {
      return res.status(400).json({ error: `Posição inválida: ${position}` });
    }
    if (!driver || typeof driver !== 'string') {
      return res.status(400).json({ error: 'Piloto inválido' });
    }
  }

  const upsert = db.prepare(`
    INSERT INTO bets (participant_id, event_id, position, driver)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(participant_id, event_id, position) DO UPDATE SET driver = excluded.driver
  `);

  const saveAll = db.transaction(() => {
    for (const { position, driver } of bets) {
      upsert.run(participant_id, event_id, position, driver);
    }
  });
  saveAll();

  res.json({ ok: true });
});

module.exports = router;
