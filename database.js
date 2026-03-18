const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'campusfix.db');

function openDB() {
  return new sqlite3.Database(DB_PATH);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function initDB() {
  const db = openDB();

  await exec(db, `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      roll_number TEXT,
      department TEXT,
      phone TEXT,
      role TEXT DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      description TEXT NOT NULL,
      status TEXT DEFAULT 'Pending',
      image_path TEXT,
      admin_note TEXT,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Add missing columns if upgrading from old DB
  try { await run(db, "ALTER TABLE complaints ADD COLUMN priority TEXT DEFAULT 'Medium'"); } catch(e) {}
  try { await run(db, "ALTER TABLE complaints ADD COLUMN location TEXT"); } catch(e) {}
  try { await run(db, "ALTER TABLE users ADD COLUMN department TEXT"); } catch(e) {}
  try { await run(db, "ALTER TABLE users ADD COLUMN phone TEXT"); } catch(e) {}

  // Seed admin
  const adminExists = await get(db, "SELECT id FROM users WHERE email = 'admin@campusfix.edu'");
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    await run(db, "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')", ['Admin', 'admin@campusfix.edu', hash]);
    console.log('✅ Admin created: admin@campusfix.edu / admin123');
  }

  // Seed student
  const studentExists = await get(db, "SELECT id FROM users WHERE email = 'student@campusfix.edu'");
  if (!studentExists) {
    const hash = bcrypt.hashSync('student123', 10);
    await run(db, "INSERT INTO users (name, email, password, roll_number, department, role) VALUES (?, ?, ?, ?, ?, 'student')",
      ['Arjun Sharma', 'student@campusfix.edu', hash, 'CS2021001', 'Computer Science']);
  }

  // Seed complaints
  const countRow = await get(db, "SELECT COUNT(*) as cnt FROM complaints");
  if (countRow.cnt === 0) {
    const student = await get(db, "SELECT id FROM users WHERE email = 'student@campusfix.edu'");
    if (student) {
      const samples = [
        { cid: 'CF-0001', title: 'Water leakage in hostel room 204', category: 'Hostel', priority: 'High', desc: 'Major water leakage from ceiling in room 204, Block B. Floor is always wet causing inconvenience and safety hazard.', status: 'In Progress', location: 'Block B, Room 204' },
        { cid: 'CF-0002', title: 'Wi-Fi not working in Library', category: 'Internet', priority: 'High', desc: 'Wi-Fi has been down for 3 days. Students unable to access online resources for assignments.', status: 'Pending', location: 'Central Library' },
        { cid: 'CF-0003', title: 'Broken projector in Lab 3', category: 'Classroom', priority: 'Medium', desc: 'Projector in Computer Lab 3 broken for over a week. Affecting practical sessions.', status: 'Resolved', location: 'Computer Lab 3' },
        { cid: 'CF-0004', title: 'Street lights not working near hostel', category: 'Electricity', priority: 'High', desc: 'Multiple street lights near hostel gate not working. Safety concern at night.', status: 'Pending', location: 'Hostel Gate Area' },
        { cid: 'CF-0005', title: 'Dustbins overflowing in canteen area', category: 'Cleanliness', priority: 'Low', desc: 'Dustbins in canteen area have not been cleaned for 2 days. Bad smell and hygiene issue.', status: 'Pending', location: 'Main Canteen' },
      ];
      for (const s of samples) {
        await run(db, "INSERT INTO complaints (complaint_id, user_id, title, category, priority, description, status, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [s.cid, student.id, s.title, s.category, s.priority, s.desc, s.status, s.location]);
      }
      console.log('✅ Sample data seeded');
    }
  }

  console.log('✅ Database ready (CampusFix v2.0)');
  return { db, run, get, all };
}

module.exports = { initDB, DB_PATH };
