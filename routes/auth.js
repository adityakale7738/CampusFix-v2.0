const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

module.exports = (db, run, get, all) => {

  router.post('/register', async (req, res) => {
    const { name, email, password, roll_number, department, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    try {
      const existing = await get(db, 'SELECT id FROM users WHERE email = ?', [email]);
      if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
      const hash = bcrypt.hashSync(password, 10);
      const result = await run(db,
        'INSERT INTO users (name, email, password, roll_number, department, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, email, hash, roll_number || null, department || null, phone || null, 'student']);
      req.session.userId = result.lastID;
      req.session.name = name;
      req.session.role = 'student';
      res.json({ success: true, role: 'student', name });
    } catch (e) {
      res.status(500).json({ error: 'Registration failed.' });
    }
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });
    try {
      const user = await get(db, 'SELECT * FROM users WHERE email = ?', [email]);
      if (!user || !bcrypt.compareSync(password, user.password))
        return res.status(401).json({ error: 'Invalid email or password.' });
      req.session.userId = user.id;
      req.session.name = user.name;
      req.session.role = user.role;
      res.json({ success: true, role: user.role, name: user.name });
    } catch (e) {
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  router.get('/session', (req, res) => {
    if (req.session && req.session.userId)
      res.json({ loggedIn: true, role: req.session.role, name: req.session.name, userId: req.session.userId });
    else
      res.json({ loggedIn: false });
  });

  router.get('/profile', async (req, res) => {
    if (!req.session || !req.session.userId)
      return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await get(db,
        'SELECT id, name, email, roll_number, department, phone, role, created_at FROM users WHERE id = ?',
        [req.session.userId]);
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: 'Failed.' });
    }
  });

  return router;
};