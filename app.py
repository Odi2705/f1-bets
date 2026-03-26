#!/usr/bin/env python3
"""F1 Bets 2026 — Flask backend (PostgreSQL)"""

import os
import json
import urllib.request
from datetime import datetime, timezone
from flask import Flask, request, jsonify, send_from_directory, send_file
import psycopg2
import psycopg2.extras

# ─── Config ───────────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get('DATABASE_URL')
PUBLIC_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')
ADMIN_TOKEN  = os.environ.get('ADMIN_TOKEN', 'f1bets2026')
F1_API_BASE  = 'https://api.jolpi.ca/ergast/f1'

app = Flask(__name__, static_folder=PUBLIC_DIR)

# ─── Database wrapper ─────────────────────────────────────────────────────────

class _Cur:
    """Wraps a psycopg2 cursor so callers can chain .fetchone()/.fetchall()."""
    def __init__(self, cur):
        self._c = cur
    def fetchone(self):
        return self._c.fetchone()
    def fetchall(self):
        return self._c.fetchall() or []

class DBConn:
    def __init__(self):
        self._conn = psycopg2.connect(
            DATABASE_URL,
            cursor_factory=psycopg2.extras.RealDictCursor
        )

    def execute(self, sql, params=None):
        sql = sql.replace('?', '%s')
        cur = self._conn.cursor()
        cur.execute(sql, params or ())
        return _Cur(cur)

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()

def get_db():
    return DBConn()

# ─── Init DB ──────────────────────────────────────────────────────────────────

def init_db():
    conn = get_db()
    stmts = [
        """CREATE TABLE IF NOT EXISTS participants (
            id   SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        )""",
        """CREATE TABLE IF NOT EXISTS race_weekends (
            id         SERIAL PRIMARY KEY,
            name       TEXT NOT NULL,
            location   TEXT,
            season     INTEGER NOT NULL DEFAULT 2026,
            round      INTEGER NOT NULL,
            has_sprint INTEGER NOT NULL DEFAULT 0,
            UNIQUE(season, round)
        )""",
        """CREATE TABLE IF NOT EXISTS events (
            id              SERIAL PRIMARY KEY,
            weekend_id      INTEGER NOT NULL REFERENCES race_weekends(id),
            type            TEXT NOT NULL CHECK(type IN ('qualify','sprint','race')),
            deadline        TEXT NOT NULL,
            completed       INTEGER NOT NULL DEFAULT 0,
            allow_late_bets INTEGER NOT NULL DEFAULT 0,
            UNIQUE(weekend_id, type)
        )""",
        """CREATE TABLE IF NOT EXISTS bets (
            id             SERIAL PRIMARY KEY,
            participant_id INTEGER NOT NULL REFERENCES participants(id),
            event_id       INTEGER NOT NULL REFERENCES events(id),
            position       INTEGER NOT NULL,
            driver         TEXT NOT NULL,
            created_at     TIMESTAMP DEFAULT NOW(),
            UNIQUE(participant_id, event_id, position)
        )""",
        """CREATE TABLE IF NOT EXISTS results (
            id       SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL REFERENCES events(id),
            position INTEGER NOT NULL,
            driver   TEXT NOT NULL,
            UNIQUE(event_id, position)
        )""",
    ]
    for stmt in stmts:
        conn.execute(stmt)
    conn.commit()
    seed_participants(conn)
    seed_calendar(conn)
    seed_australian_results(conn)
    conn.commit()
    conn.close()

def seed_participants(conn):
    for name in ['Odair', 'Adriano', 'Fátima', 'Renato', 'Ximenes', 'Lucas']:
        conn.execute(
            'INSERT INTO participants (name) VALUES (?) ON CONFLICT DO NOTHING',
            (name,)
        )

CALENDAR_2026 = [
    (1,  'Australian GP',    'Melbourne',   False, [
        ('qualify', '2026-03-14T04:00:00Z', 1),
        ('race',    '2026-03-15T04:00:00Z', 1),
    ]),
    (2,  'Chinese GP',       'Shanghai',    True,  [
        ('sprint',  '2026-03-14T03:00:00Z', 1),
        ('qualify', '2026-03-14T07:00:00Z', 1),
        ('race',    '2026-03-15T07:00:00Z', 1),
    ]),
    (3,  'Japanese GP',      'Suzuka',      False, [
        ('qualify', '2026-04-04T06:00:00Z', 0),
        ('race',    '2026-04-05T05:00:00Z', 0),
    ]),
    (4,  'Bahrain GP',       'Sakhir',      False, [
        ('qualify', '2026-04-18T15:00:00Z', 0),
        ('race',    '2026-04-19T17:00:00Z', 0),
    ]),
    (5,  'Saudi Arabian GP', 'Jeddah',      False, [
        ('qualify', '2026-04-25T17:00:00Z', 0),
        ('race',    '2026-04-26T19:00:00Z', 0),
    ]),
    (6,  'Miami GP',         'Miami',       True,  [
        ('sprint',  '2026-05-02T20:30:00Z', 0),
        ('qualify', '2026-05-03T00:00:00Z', 0),
        ('race',    '2026-05-03T19:30:00Z', 0),
    ]),
    (7,  'Emilia-Romagna GP','Imola',       False, [
        ('qualify', '2026-05-23T13:00:00Z', 0),
        ('race',    '2026-05-24T13:00:00Z', 0),
    ]),
    (8,  'Monaco GP',        'Monaco',      False, [
        ('qualify', '2026-05-23T13:00:00Z', 0),
        ('race',    '2026-05-24T13:00:00Z', 0),
    ]),
    (9,  'Spanish GP',       'Barcelona',   False, [
        ('qualify', '2026-05-30T13:00:00Z', 0),
        ('race',    '2026-05-31T13:00:00Z', 0),
    ]),
    (10, 'Canadian GP',      'Montreal',    False, [
        ('qualify', '2026-06-13T22:00:00Z', 0),
        ('race',    '2026-06-14T18:00:00Z', 0),
    ]),
    (11, 'Austrian GP',      'Spielberg',   False, [
        ('qualify', '2026-06-27T13:00:00Z', 0),
        ('race',    '2026-06-28T13:00:00Z', 0),
    ]),
    (12, 'British GP',       'Silverstone', False, [
        ('qualify', '2026-07-04T14:00:00Z', 0),
        ('race',    '2026-07-05T14:00:00Z', 0),
    ]),
    (13, 'Belgian GP',       'Spa',         False, [
        ('qualify', '2026-07-25T13:00:00Z', 0),
        ('race',    '2026-07-26T13:00:00Z', 0),
    ]),
    (14, 'Hungarian GP',     'Budapest',    False, [
        ('qualify', '2026-08-01T13:00:00Z', 0),
        ('race',    '2026-08-02T13:00:00Z', 0),
    ]),
    (15, 'Dutch GP',         'Zandvoort',   False, [
        ('qualify', '2026-08-29T13:00:00Z', 0),
        ('race',    '2026-08-30T13:00:00Z', 0),
    ]),
    (16, 'Italian GP',       'Monza',       False, [
        ('qualify', '2026-09-05T13:00:00Z', 0),
        ('race',    '2026-09-06T13:00:00Z', 0),
    ]),
    (17, 'Azerbaijan GP',    'Baku',        True,  [
        ('sprint',  '2026-09-19T07:30:00Z', 0),
        ('qualify', '2026-09-19T13:00:00Z', 0),
        ('race',    '2026-09-20T11:00:00Z', 0),
    ]),
    (18, 'Singapore GP',     'Singapore',   False, [
        ('qualify', '2026-10-03T13:00:00Z', 0),
        ('race',    '2026-10-04T12:00:00Z', 0),
    ]),
    (19, 'United States GP', 'Austin',      True,  [
        ('sprint',  '2026-10-17T16:00:00Z', 0),
        ('qualify', '2026-10-17T22:00:00Z', 0),
        ('race',    '2026-10-18T19:00:00Z', 0),
    ]),
    (20, 'Mexico City GP',   'Mexico City', False, [
        ('qualify', '2026-10-24T22:00:00Z', 0),
        ('race',    '2026-10-25T20:00:00Z', 0),
    ]),
    (21, 'Brazilian GP',     'São Paulo',   True,  [
        ('sprint',  '2026-11-07T14:30:00Z', 0),
        ('qualify', '2026-11-07T18:00:00Z', 0),
        ('race',    '2026-11-08T17:00:00Z', 0),
    ]),
    (22, 'Las Vegas GP',     'Las Vegas',   False, [
        ('qualify', '2026-11-21T06:00:00Z', 0),
        ('race',    '2026-11-22T06:00:00Z', 0),
    ]),
    (23, 'Qatar GP',         'Lusail',      True,  [
        ('sprint',  '2026-11-28T10:30:00Z', 0),
        ('qualify', '2026-11-28T14:00:00Z', 0),
        ('race',    '2026-11-29T13:00:00Z', 0),
    ]),
    (24, 'Abu Dhabi GP',     'Yas Marina',  False, [
        ('qualify', '2026-12-05T13:00:00Z', 0),
        ('race',    '2026-12-06T13:00:00Z', 0),
    ]),
]

def seed_calendar(conn):
    for (rnd, name, loc, sprint, evts) in CALENDAR_2026:
        conn.execute(
            'INSERT INTO race_weekends (name,location,season,round,has_sprint) VALUES (?,?,2026,?,?) ON CONFLICT DO NOTHING',
            (name, loc, rnd, 1 if sprint else 0)
        )
        for (etype, deadline, late) in evts:
            conn.execute("""
                INSERT INTO events (weekend_id, type, deadline, allow_late_bets)
                SELECT id, ?, ?, ? FROM race_weekends WHERE season=2026 AND round=?
                ON CONFLICT DO NOTHING
            """, (etype, deadline, late, rnd))

def seed_australian_results(conn):
    qual = conn.execute("""
        SELECT e.id FROM events e
        JOIN race_weekends w ON w.id = e.weekend_id
        WHERE w.season=2026 AND w.round=1 AND e.type='qualify'
    """).fetchone()
    race = conn.execute("""
        SELECT e.id FROM events e
        JOIN race_weekends w ON w.id = e.weekend_id
        WHERE w.season=2026 AND w.round=1 AND e.type='race'
    """).fetchone()

    if qual:
        conn.execute('UPDATE events SET completed=1 WHERE id=?', (qual['id'],))
        for pos, driver in enumerate(['Russell','Antonelli','Hadjar'], 1):
            conn.execute(
                'INSERT INTO results (event_id,position,driver) VALUES (?,?,?) ON CONFLICT DO NOTHING',
                (qual['id'], pos, driver)
            )
    if race:
        conn.execute('UPDATE events SET completed=1 WHERE id=?', (race['id'],))
        for pos, driver in enumerate([
            'Russell','Antonelli','Leclerc','Hamilton','Norris',
            'Verstappen','Bearman','Lindblad','Bortoleto','Gasly'
        ], 1):
            conn.execute(
                'INSERT INTO results (event_id,position,driver) VALUES (?,?,?) ON CONFLICT DO NOTHING',
                (race['id'], pos, driver)
            )

# ─── Auth helper ──────────────────────────────────────────────────────────────

def require_admin():
    token = request.headers.get('X-Admin-Token') or request.args.get('token', '')
    if token != ADMIN_TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    return None

# ─── F1 API ───────────────────────────────────────────────────────────────────

def fetch_f1(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'F1Bets/1.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())

def fetch_qualifying(season, round_num):
    data = fetch_f1(f'{F1_API_BASE}/{season}/{round_num}/qualifying.json')
    races = data.get('MRData',{}).get('QualifyingTable',{}).get('Races',[])
    if not races: return None
    return [{'position': int(r['position']), 'driver': r['Driver']['familyName']}
            for r in races[0]['QualifyingResults']]

def fetch_race(season, round_num):
    data = fetch_f1(f'{F1_API_BASE}/{season}/{round_num}/results.json')
    races = data.get('MRData',{}).get('RaceTable',{}).get('Races',[])
    if not races: return None
    return [{'position': int(r['position']), 'driver': r['Driver']['familyName']}
            for r in races[0]['Results'][:10]]

def fetch_sprint(season, round_num):
    data = fetch_f1(f'{F1_API_BASE}/{season}/{round_num}/sprint.json')
    races = data.get('MRData',{}).get('RaceTable',{}).get('Races',[])
    if not races: return None
    return [{'position': int(r['position']), 'driver': r['Driver']['familyName']}
            for r in races[0]['SprintResults'][:3]]

# ─── Helper to convert Row to dict ───────────────────────────────────────────

def row2dict(row):
    return dict(row) if row else None

def rows2list(rows):
    return [dict(r) for r in rows]

# ─── Serve static files ───────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_file(os.path.join(PUBLIC_DIR, 'index.html'))

@app.route('/<path:filename>')
def static_files(filename):
    try:
        return send_from_directory(PUBLIC_DIR, filename)
    except Exception:
        return send_file(os.path.join(PUBLIC_DIR, 'index.html'))

# ─── Participants ─────────────────────────────────────────────────────────────

@app.route('/api/events/participants')
def get_participants():
    conn = get_db()
    rows = conn.execute('SELECT * FROM participants ORDER BY id').fetchall()
    conn.close()
    return jsonify(rows2list(rows))

# ─── Events ───────────────────────────────────────────────────────────────────

@app.route('/api/events')
def get_events():
    conn = get_db()
    rows = conn.execute("""
        SELECT e.*, w.name AS weekend_name, w.round, w.season, w.has_sprint, w.location
        FROM events e JOIN race_weekends w ON w.id = e.weekend_id
        WHERE w.season=2026 ORDER BY w.round, e.type
    """).fetchall()
    conn.close()
    return jsonify(rows2list(rows))

@app.route('/api/events/next')
def get_next_events():
    conn = get_db()
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    rows = conn.execute("""
        SELECT e.*, w.name AS weekend_name, w.round, w.season, w.has_sprint, w.location
        FROM events e JOIN race_weekends w ON w.id = e.weekend_id
        WHERE w.season=2026 AND (e.deadline > ? OR e.allow_late_bets=1)
        ORDER BY w.round, e.type LIMIT 6
    """, (now,)).fetchall()
    conn.close()
    return jsonify(rows2list(rows))

@app.route('/api/events/weekend/<int:weekend_id>')
def get_weekend_events(weekend_id):
    conn = get_db()
    rows = conn.execute("""
        SELECT e.*, w.name AS weekend_name, w.round, w.season
        FROM events e JOIN race_weekends w ON w.id = e.weekend_id
        WHERE e.weekend_id=? ORDER BY e.type
    """, (weekend_id,)).fetchall()
    conn.close()
    return jsonify(rows2list(rows))

@app.route('/api/events/<int:event_id>')
def get_event(event_id):
    conn = get_db()
    row = conn.execute("""
        SELECT e.*, w.name AS weekend_name, w.round, w.season, w.has_sprint, w.location
        FROM events e JOIN race_weekends w ON w.id = e.weekend_id WHERE e.id=?
    """, (event_id,)).fetchone()
    conn.close()
    if not row: return jsonify({'error': 'Not found'}), 404
    return jsonify(row2dict(row))

# ─── Bets ─────────────────────────────────────────────────────────────────────

@app.route('/api/bets/event/<int:event_id>')
def get_event_bets(event_id):
    conn = get_db()
    rows = conn.execute("""
        SELECT b.*, p.name AS participant_name FROM bets b
        JOIN participants p ON p.id = b.participant_id
        WHERE b.event_id=? ORDER BY p.name, b.position
    """, (event_id,)).fetchall()
    conn.close()
    return jsonify(rows2list(rows))

@app.route('/api/bets/event/<int:event_id>/participant/<int:participant_id>')
def get_participant_bets(event_id, participant_id):
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM bets WHERE event_id=? AND participant_id=? ORDER BY position',
        (event_id, participant_id)
    ).fetchall()
    conn.close()
    return jsonify(rows2list(rows))

@app.route('/api/bets', methods=['POST'])
def submit_bets():
    body = request.get_json()
    participant_id = body.get('participant_id')
    event_id       = body.get('event_id')
    bets           = body.get('bets', [])

    if not participant_id or not event_id or not bets:
        return jsonify({'error': 'Payload inválido'}), 400

    conn = get_db()
    event = conn.execute("""
        SELECT e.*, w.round, w.season FROM events e
        JOIN race_weekends w ON w.id = e.weekend_id WHERE e.id=?
    """, (event_id,)).fetchone()

    if not event:
        conn.close()
        return jsonify({'error': 'Etapa não encontrada'}), 404

    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    if event['allow_late_bets'] == 0 and now > event['deadline']:
        conn.close()
        return jsonify({'error': 'Prazo encerrado para esta etapa'}), 403

    max_pos = 10 if event['type'] == 'race' else 3
    for b in bets:
        if not isinstance(b.get('position'), int) or not (1 <= b['position'] <= max_pos):
            conn.close()
            return jsonify({'error': f"Posição inválida: {b.get('position')}"}), 400

    for b in bets:
        conn.execute("""
            INSERT INTO bets (participant_id, event_id, position, driver)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(participant_id, event_id, position)
            DO UPDATE SET driver=EXCLUDED.driver
        """, (participant_id, event_id, b['position'], b['driver']))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})

# ─── Standings ────────────────────────────────────────────────────────────────

@app.route('/api/standings')
def get_standings():
    conn = get_db()
    participants = rows2list(conn.execute('SELECT * FROM participants ORDER BY id').fetchall())
    weekends     = rows2list(conn.execute(
        'SELECT * FROM race_weekends WHERE season=2026 ORDER BY round'
    ).fetchall())

    pts_rows = conn.execute("""
        SELECT e.weekend_id, b.participant_id,
          SUM(CASE WHEN LOWER(r.driver)=LOWER(b.driver) AND r.position=b.position THEN 1 ELSE 0 END) AS pts
        FROM bets b
        JOIN events e ON e.id=b.event_id AND e.completed=1
        JOIN results r ON r.event_id=e.id
        GROUP BY e.weekend_id, b.participant_id
    """).fetchall()
    conn.close()

    pts_map = {}
    for row in pts_rows:
        pts_map.setdefault(row['weekend_id'], {})[row['participant_id']] = row['pts']

    totals = {p['id']: 0 for p in participants}
    rows = []
    for w in weekends:
        entry = {'weekend_id': w['id'], 'name': w['name'], 'round': w['round']}
        wmap = pts_map.get(w['id'], {})
        for p in participants:
            v = wmap.get(p['id'], 0)
            entry[str(p['id'])] = v
            totals[p['id']] += v
        rows.append(entry)

    return jsonify({
        'participants': participants,
        'rows': rows,
        'totals': {str(k): v for k, v in totals.items()},
    })

@app.route('/api/standings/event/<int:event_id>')
def get_event_standings(event_id):
    conn = get_db()
    event = conn.execute("""
        SELECT e.*, w.name AS weekend_name, w.round, w.season, w.has_sprint, w.location
        FROM events e JOIN race_weekends w ON w.id=e.weekend_id WHERE e.id=?
    """, (event_id,)).fetchone()
    if not event:
        conn.close()
        return jsonify({'error': 'Not found'}), 404

    results = rows2list(conn.execute(
        'SELECT * FROM results WHERE event_id=? ORDER BY position', (event_id,)
    ).fetchall())
    result_drivers = {r['driver'].lower() for r in results}
    result_by_pos  = {r['position']: r['driver'] for r in results}

    participants = rows2list(conn.execute('SELECT * FROM participants ORDER BY id').fetchall())
    participant_data = []
    for p in participants:
        bets = rows2list(conn.execute(
            'SELECT * FROM bets WHERE event_id=? AND participant_id=? ORDER BY position',
            (event_id, p['id'])
        ).fetchall())
        total = 0
        bet_rows = []
        for b in bets:
            res_driver = result_by_pos.get(b['position'])
            if res_driver and res_driver.lower() == b['driver'].lower():
                status, points = 'exact', 1
            elif b['driver'].lower() in result_drivers:
                status, points = 'other', 0
            else:
                status, points = 'wrong', 0
            total += points
            bet_rows.append({'position': b['position'], 'driver': b['driver'],
                             'points': points, 'status': status})
        participant_data.append({'id': p['id'], 'name': p['name'],
                                 'bets': bet_rows, 'total': total})

    conn.close()
    return jsonify({'event': row2dict(event), 'results': results,
                    'participants': participant_data})

@app.route('/api/standings/weekend/<int:weekend_id>')
def get_weekend_standings(weekend_id):
    conn = get_db()
    rows = conn.execute("""
        SELECT e.*, w.name AS weekend_name, w.round, w.season
        FROM events e JOIN race_weekends w ON w.id=e.weekend_id
        WHERE e.weekend_id=? AND e.completed=1 ORDER BY e.type
    """, (weekend_id,)).fetchall()
    conn.close()
    return jsonify(rows2list(rows))

# ─── Admin ────────────────────────────────────────────────────────────────────

@app.route('/api/admin/weekends')
def admin_weekends():
    err = require_admin()
    if err: return err
    conn = get_db()
    rows = conn.execute("""
        SELECT w.*,
          (SELECT COUNT(*) FROM events e WHERE e.weekend_id=w.id AND e.completed=1) AS completed_events,
          (SELECT COUNT(*) FROM events e WHERE e.weekend_id=w.id) AS total_events
        FROM race_weekends w WHERE w.season=2026 ORDER BY w.round
    """).fetchall()
    conn.close()
    return jsonify(rows2list(rows))

@app.route('/api/admin/fetch-results/<int:event_id>', methods=['POST'])
def admin_fetch_results(event_id):
    err = require_admin()
    if err: return err
    conn = get_db()
    event = conn.execute("""
        SELECT e.*, w.round, w.season FROM events e
        JOIN race_weekends w ON w.id=e.weekend_id WHERE e.id=?
    """, (event_id,)).fetchone()
    if not event:
        conn.close()
        return jsonify({'error': 'Not found'}), 404

    try:
        if event['type'] == 'qualify':
            results = fetch_qualifying(event['season'], event['round'])
        elif event['type'] == 'race':
            results = fetch_race(event['season'], event['round'])
        else:
            results = fetch_sprint(event['season'], event['round'])

        if not results:
            conn.close()
            return jsonify({'error': 'Resultados não encontrados na API F1'}), 404

        for r in results:
            conn.execute(
                'INSERT INTO results (event_id,position,driver) VALUES (?,?,?) ON CONFLICT (event_id,position) DO UPDATE SET driver=EXCLUDED.driver',
                (event_id, r['position'], r['driver'])
            )
        conn.execute('UPDATE events SET completed=1 WHERE id=?', (event_id,))
        conn.commit()
        conn.close()
        return jsonify({'ok': True, 'results': results})
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/set-results/<int:event_id>', methods=['POST'])
def admin_set_results(event_id):
    err = require_admin()
    if err: return err
    body = request.get_json()
    results = body.get('results', [])
    if not results:
        return jsonify({'error': 'Resultados inválidos'}), 400
    conn = get_db()
    for r in results:
        conn.execute(
            'INSERT INTO results (event_id,position,driver) VALUES (?,?,?) ON CONFLICT (event_id,position) DO UPDATE SET driver=EXCLUDED.driver',
            (event_id, r['position'], r['driver'])
        )
    conn.execute('UPDATE events SET completed=1 WHERE id=?', (event_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})

@app.route('/api/admin/events/<int:event_id>/reopen', methods=['PUT'])
def admin_reopen(event_id):
    err = require_admin()
    if err: return err
    conn = get_db()
    conn.execute('UPDATE events SET allow_late_bets=1 WHERE id=?', (event_id,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

@app.route('/api/admin/events/<int:event_id>/close', methods=['PUT'])
def admin_close(event_id):
    err = require_admin()
    if err: return err
    conn = get_db()
    conn.execute('UPDATE events SET allow_late_bets=0 WHERE id=?', (event_id,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

@app.route('/api/admin/events/<int:event_id>/uncomplete', methods=['PUT'])
def admin_uncomplete(event_id):
    err = require_admin()
    if err: return err
    conn = get_db()
    conn.execute('UPDATE events SET completed=0 WHERE id=?', (event_id,))
    conn.execute('DELETE FROM results WHERE event_id=?', (event_id,))
    conn.commit(); conn.close()
    return jsonify({'ok': True})

# ─── Run ──────────────────────────────────────────────────────────────────────

# Initialize DB at module level so gunicorn workers also run it
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=False)
