const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendStatusUpdateEmail } = require('../email');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

async function generateComplaintId(db, get) {
  const last = await get(db, "SELECT complaint_id FROM complaints ORDER BY id DESC LIMIT 1");
  if (!last) return 'CF-0001';
  const num = parseInt(last.complaint_id.split('-')[1]) + 1;
  return 'CF-' + String(num).padStart(4, '0');
}

module.exports = (db, run, get, all) => {

  // Student: Submit
  router.post('/submit', requireAuth, upload.single('image'), async (req, res) => {
    const { title, category, priority, description, location } = req.body;
    if (!title || !category || !description)
      return res.status(400).json({ error: 'Title, category, and description are required.' });
    const validCategories = ['Hostel', 'Classroom', 'Electricity', 'Water', 'Internet', 'Cleanliness'];
    const validPriorities = ['Low', 'Medium', 'High'];
    if (!validCategories.includes(category)) return res.status(400).json({ error: 'Invalid category.' });
    const finalPriority = validPriorities.includes(priority) ? priority : 'Medium';
    const imagePath = req.file ? '/uploads/' + req.file.filename : null;
    try {
      const complaintId = await generateComplaintId(db, get);
      await run(db,
        'INSERT INTO complaints (complaint_id, user_id, title, category, priority, description, image_path, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [complaintId, req.session.userId, title, category, finalPriority, description, imagePath, location || null]);
      res.json({ success: true, complaintId });
    } catch (e) {
      res.status(500).json({ error: 'Failed to submit complaint.' });
    }
  });

  // Student: My complaints
  router.get('/my', requireAuth, async (req, res) => {
    try {
      const complaints = await all(db,
        'SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC',
        [req.session.userId]);
      res.json(complaints);
    } catch (e) { res.status(500).json({ error: 'Failed.' }); }
  });

  // Student: Single
  router.get('/my/:id', requireAuth, async (req, res) => {
    try {
      const complaint = await get(db,
        'SELECT * FROM complaints WHERE complaint_id = ? AND user_id = ?',
        [req.params.id, req.session.userId]);
      if (!complaint) return res.status(404).json({ error: 'Not found.' });
      res.json(complaint);
    } catch (e) { res.status(500).json({ error: 'Failed.' }); }
  });

  // Admin: All complaints
  router.get('/all', requireAdmin, async (req, res) => {
    const { status, category, priority, search } = req.query;
    let query = `SELECT c.*, u.name as student_name, u.email as student_email, u.roll_number, u.department
                 FROM complaints c JOIN users u ON c.user_id = u.id WHERE 1=1`;
    const params = [];
    if (status) { query += ' AND c.status = ?'; params.push(status); }
    if (category) { query += ' AND c.category = ?'; params.push(category); }
    if (priority) { query += ' AND c.priority = ?'; params.push(priority); }
    if (search) {
      query += ' AND (c.title LIKE ? OR c.complaint_id LIKE ? OR u.name LIKE ? OR c.location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY CASE c.priority WHEN "High" THEN 1 WHEN "Medium" THEN 2 WHEN "Low" THEN 3 END, c.created_at DESC';
    try {
      const complaints = await all(db, query, params);
      res.json(complaints);
    } catch (e) { res.status(500).json({ error: 'Failed.' }); }
  });

  // Admin: Update status + send email
  router.patch('/:id/status', requireAdmin, async (req, res) => {
    const { status, admin_note } = req.body;
    const valid = ['Pending', 'In Progress', 'Resolved'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    try {
      const complaint = await get(db, 'SELECT * FROM complaints WHERE complaint_id = ?', [req.params.id]);
      if (!complaint) return res.status(404).json({ error: 'Not found.' });
      const result = await run(db,
        'UPDATE complaints SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE complaint_id = ?',
        [status, admin_note || null, req.params.id]);
      if (result.changes === 0) return res.status(404).json({ error: 'Not found.' });

      // Send email notification
      const user = await get(db, 'SELECT * FROM users WHERE id = ?', [complaint.user_id]);
      if (user && user.email) {
        sendStatusUpdateEmail({
          to: user.email,
          studentName: user.name,
          complaintId: complaint.complaint_id,
          title: complaint.title,
          status,
          adminNote: admin_note
        });
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Update failed.' }); }
  });

  // Admin: Delete
  router.delete('/:id', requireAdmin, async (req, res) => {
    try {
      const complaint = await get(db, 'SELECT * FROM complaints WHERE complaint_id = ?', [req.params.id]);
      if (!complaint) return res.status(404).json({ error: 'Not found.' });
      if (complaint.image_path) {
        const imgFile = path.join(__dirname, '../public', complaint.image_path);
        if (fs.existsSync(imgFile)) fs.unlinkSync(imgFile);
      }
      await run(db, 'DELETE FROM complaints WHERE complaint_id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Delete failed.' }); }
  });

  // Admin: Stats
  router.get('/stats', requireAdmin, async (req, res) => {
    try {
      const total = (await get(db, 'SELECT COUNT(*) as count FROM complaints')).count;
      const pending = (await get(db, "SELECT COUNT(*) as count FROM complaints WHERE status='Pending'")).count;
      const inProgress = (await get(db, "SELECT COUNT(*) as count FROM complaints WHERE status='In Progress'")).count;
      const resolved = (await get(db, "SELECT COUNT(*) as count FROM complaints WHERE status='Resolved'")).count;
      const byCategory = await all(db, 'SELECT category, COUNT(*) as count FROM complaints GROUP BY category ORDER BY count DESC');
      const byPriority = await all(db, 'SELECT priority, COUNT(*) as count FROM complaints GROUP BY priority');
      const recentActivity = await all(db, `SELECT c.complaint_id, c.title, c.status, c.priority, c.updated_at, u.name as student_name
        FROM complaints c JOIN users u ON c.user_id = u.id ORDER BY c.updated_at DESC LIMIT 5`);
      res.json({ total, pending, inProgress, resolved, byCategory, byPriority, recentActivity });
    } catch (e) { res.status(500).json({ error: 'Failed.' }); }
  });

  return router;
};
