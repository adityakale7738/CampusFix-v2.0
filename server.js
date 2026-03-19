require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'campusfix-v2-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

initDB().then(({ db, run, get, all }) => {
  app.use('/api/auth', require('./routes/auth')(db, run, get, all));
  app.use('/api/complaints', require('./routes/complaints')(db, run, get, all));

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

  app.listen(PORT, () => {
    console.log(`\n🎓 CampusFix v2.0 running at http://localhost:${PORT}`);
    console.log(`\n📋 Credentials:`);
    console.log(`   Admin   → admin@campusfix.edu / admin123`);
    console.log(`   Student → student@campusfix.edu / student123`);
    console.log(`\n📧 Email: Set EMAIL_USER and EMAIL_PASS env vars to enable notifications\n`);
  });
}).catch(err => {
  console.error('❌ DB init failed:', err);
  process.exit(1);
});
