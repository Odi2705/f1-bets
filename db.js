const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'f1bets.db');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS race_weekends (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      location   TEXT,
      season     INTEGER NOT NULL DEFAULT 2025,
      round      INTEGER NOT NULL,
      has_sprint INTEGER NOT NULL DEFAULT 0,
      UNIQUE(season, round)
    );

    CREATE TABLE IF NOT EXISTS events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      weekend_id      INTEGER NOT NULL REFERENCES race_weekends(id),
      type            TEXT NOT NULL CHECK(type IN ('qualify','sprint','race')),
      deadline        TEXT NOT NULL,
      completed       INTEGER NOT NULL DEFAULT 0,
      allow_late_bets INTEGER NOT NULL DEFAULT 0,
      UNIQUE(weekend_id, type)
    );

    CREATE TABLE IF NOT EXISTS bets (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL REFERENCES participants(id),
      event_id       INTEGER NOT NULL REFERENCES events(id),
      position       INTEGER NOT NULL,
      driver         TEXT NOT NULL,
      created_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(participant_id, event_id, position)
    );

    CREATE TABLE IF NOT EXISTS results (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id),
      position INTEGER NOT NULL,
      driver   TEXT NOT NULL,
      UNIQUE(event_id, position)
    );
  `);

  seedParticipants(db);
  seed2025Calendar(db);
  seedAustralianGPResults(db);
}

function seedParticipants(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO participants (name) VALUES (?)');
  ['Odair', 'Adriano', 'Fátima', 'Renato', 'Ximenes', 'Lucas'].forEach(n => insert.run(n));
}

function seed2025Calendar(db) {
  const insertWeekend = db.prepare(`
    INSERT OR IGNORE INTO race_weekends (name, location, season, round, has_sprint)
    VALUES (?, ?, 2025, ?, ?)
  `);
  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO events (weekend_id, type, deadline, allow_late_bets)
    SELECT id, ?, ?, ? FROM race_weekends WHERE season = 2025 AND round = ?
  `);

  const calendar = [
    {
      round: 1, name: 'Australian GP', location: 'Melbourne', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-03-15T04:00:00Z', late: 1 },
        { type: 'race',    deadline: '2025-03-16T04:00:00Z', late: 1 },
      ]
    },
    {
      round: 2, name: 'Chinese GP', location: 'Shanghai', sprint: true,
      events: [
        { type: 'sprint',  deadline: '2025-03-22T03:00:00Z', late: 0 },
        { type: 'qualify', deadline: '2025-03-22T07:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-03-23T07:00:00Z', late: 0 },
      ]
    },
    {
      round: 3, name: 'Japanese GP', location: 'Suzuka', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-04-05T06:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-04-06T05:00:00Z', late: 0 },
      ]
    },
    {
      round: 4, name: 'Bahrain GP', location: 'Sakhir', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-04-12T15:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-04-13T17:00:00Z', late: 0 },
      ]
    },
    {
      round: 5, name: 'Saudi Arabian GP', location: 'Jeddah', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-04-19T17:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-04-20T19:00:00Z', late: 0 },
      ]
    },
    {
      round: 6, name: 'Miami GP', location: 'Miami', sprint: true,
      events: [
        { type: 'sprint',  deadline: '2025-05-03T20:30:00Z', late: 0 },
        { type: 'qualify', deadline: '2025-05-04T00:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-05-04T19:30:00Z', late: 0 },
      ]
    },
    {
      round: 7, name: 'Emilia-Romagna GP', location: 'Imola', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-05-17T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-05-18T13:00:00Z', late: 0 },
      ]
    },
    {
      round: 8, name: 'Monaco GP', location: 'Monaco', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-05-24T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-05-25T13:00:00Z', late: 0 },
      ]
    },
    {
      round: 9, name: 'Spanish GP', location: 'Barcelona', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-05-31T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-06-01T13:00:00Z', late: 0 },
      ]
    },
    {
      round: 10, name: 'Canadian GP', location: 'Montreal', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-06-14T22:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-06-15T18:00:00Z', late: 0 },
      ]
    },
    {
      round: 11, name: 'Austrian GP', location: 'Spielberg', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-06-28T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-06-29T13:00:00Z', late: 0 },
      ]
    },
    {
      round: 12, name: 'British GP', location: 'Silverstone', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-07-05T14:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-07-06T14:00:00Z', late: 0 },
      ]
    },
    {
      round: 13, name: 'Belgian GP', location: 'Spa', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-07-26T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-07-27T13:00:00Z', late: 0 },
      ]
    },
    {
      round: 14, name: 'Hungarian GP', location: 'Budapest', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-08-02T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-08-03T13:00:00Z', late: 0 },
      ]
    },
    {
      round: 15, name: 'Dutch GP', location: 'Zandvoort', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-08-30T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-08-31T13:00:00Z', late: 0 },
      ]
    },
    {
      round: 16, name: 'Italian GP', location: 'Monza', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-09-06T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-09-07T13:00:00Z', late: 0 },
      ]
    },
    {
      round: 17, name: 'Azerbaijan GP', location: 'Baku', sprint: true,
      events: [
        { type: 'sprint',  deadline: '2025-09-20T07:30:00Z', late: 0 },
        { type: 'qualify', deadline: '2025-09-20T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-09-21T11:00:00Z', late: 0 },
      ]
    },
    {
      round: 18, name: 'Singapore GP', location: 'Singapore', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-10-04T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-10-05T12:00:00Z', late: 0 },
      ]
    },
    {
      round: 19, name: 'United States GP', location: 'Austin', sprint: true,
      events: [
        { type: 'sprint',  deadline: '2025-10-18T16:00:00Z', late: 0 },
        { type: 'qualify', deadline: '2025-10-18T22:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-10-19T19:00:00Z', late: 0 },
      ]
    },
    {
      round: 20, name: 'Mexico City GP', location: 'Mexico City', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-10-25T22:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-10-26T20:00:00Z', late: 0 },
      ]
    },
    {
      round: 21, name: 'Brazilian GP', location: 'São Paulo', sprint: true,
      events: [
        { type: 'sprint',  deadline: '2025-11-08T14:30:00Z', late: 0 },
        { type: 'qualify', deadline: '2025-11-08T18:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-11-09T17:00:00Z', late: 0 },
      ]
    },
    {
      round: 22, name: 'Las Vegas GP', location: 'Las Vegas', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-11-22T06:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-11-23T06:00:00Z', late: 0 },
      ]
    },
    {
      round: 23, name: 'Qatar GP', location: 'Lusail', sprint: true,
      events: [
        { type: 'sprint',  deadline: '2025-11-29T10:30:00Z', late: 0 },
        { type: 'qualify', deadline: '2025-11-29T14:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-11-30T13:00:00Z', late: 0 },
      ]
    },
    {
      round: 24, name: 'Abu Dhabi GP', location: 'Yas Marina', sprint: false,
      events: [
        { type: 'qualify', deadline: '2025-12-06T13:00:00Z', late: 0 },
        { type: 'race',    deadline: '2025-12-07T13:00:00Z', late: 0 },
      ]
    },
  ];

  for (const gp of calendar) {
    insertWeekend.run(gp.name, gp.location, gp.round, gp.sprint ? 1 : 0);
    for (const ev of gp.events) {
      insertEvent.run(ev.type, ev.deadline, ev.late, gp.round);
    }
  }
}

function seedAustralianGPResults(db) {
  // Mark Australian GP events as completed and seed known results
  const getEventId = db.prepare(`
    SELECT e.id FROM events e
    JOIN race_weekends w ON w.id = e.weekend_id
    WHERE w.season = 2025 AND w.round = 1 AND e.type = ?
  `);
  const markComplete = db.prepare('UPDATE events SET completed = 1 WHERE id = ?');
  const insertResult = db.prepare(
    'INSERT OR IGNORE INTO results (event_id, position, driver) VALUES (?, ?, ?)'
  );

  const qualifyId = getEventId.get('qualify')?.id;
  const raceId    = getEventId.get('race')?.id;

  if (qualifyId) {
    markComplete.run(qualifyId);
    [['Russell'], ['Antonelli'], ['Hadjar']].forEach(([d], i) =>
      insertResult.run(qualifyId, i + 1, d)
    );
  }

  if (raceId) {
    markComplete.run(raceId);
    [
      'Russell', 'Antonelli', 'Leclerc', 'Hamilton', 'Norris',
      'Verstappen', 'Bearman', 'Lindblad', 'Bortoleto', 'Gasly',
    ].forEach((d, i) => insertResult.run(raceId, i + 1, d));
  }
}

module.exports = { getDb, initDb };
