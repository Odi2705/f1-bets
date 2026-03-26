const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

initDb();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/events',    require('./routes/events'));
app.use('/api/bets',      require('./routes/bets'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/standings', require('./routes/standings'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🏎️  F1 Bets app running at http://localhost:${PORT}\n`);
});
