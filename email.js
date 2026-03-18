const nodemailer = require('nodemailer');

// Configure transporter - uses Gmail SMTP
// Students/Admin set their email credentials in .env or config
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || ''
    }
  });
}

async function sendStatusUpdateEmail({ to, studentName, complaintId, title, status, adminNote }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('📧 Email not configured - skipping notification');
    return;
  }
  const statusColors = {
    'Pending': '#f59e0b',
    'In Progress': '#3b82f6',
    'Resolved': '#10b981'
  };
  const statusEmojis = {
    'Pending': '⏳',
    'In Progress': '🔧',
    'Resolved': '✅'
  };
  const color = statusColors[status] || '#4f46e5';
  const emoji = statusEmojis[status] || '📋';

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#1e1b4b,#4f46e5);padding:32px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:24px;font-weight:800;">🎓 CampusFix</h1>
        <p style="color:#a5b4fc;margin:8px 0 0;font-size:14px;">Campus Complaint Management System</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#64748b;font-size:14px;margin:0 0 24px;">Hi <strong style="color:#0f172a;">${studentName}</strong>,</p>
        <p style="color:#0f172a;font-size:16px;margin:0 0 24px;">Your complaint status has been updated.</p>
        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0;">
          <div style="margin-bottom:12px;"><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Complaint ID</span><p style="margin:4px 0;font-size:14px;font-weight:600;color:#4f46e5;">${complaintId}</p></div>
          <div style="margin-bottom:12px;"><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Title</span><p style="margin:4px 0;font-size:14px;color:#0f172a;">${title}</p></div>
          <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">New Status</span>
            <p style="margin:8px 0 0;"><span style="background:${color}20;color:${color};padding:6px 14px;border-radius:100px;font-size:13px;font-weight:700;">${emoji} ${status}</span></p>
          </div>
        </div>
        ${adminNote ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px;margin-bottom:24px;"><p style="font-size:11px;color:#0369a1;text-transform:uppercase;font-weight:600;margin:0 0 6px;">Admin Note</p><p style="color:#0f172a;font-size:14px;margin:0;">${adminNote}</p></div>` : ''}
        <p style="color:#64748b;font-size:13px;margin:0;">Login to CampusFix to view full details.</p>
      </div>
      <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">© 2024 CampusFix — Campus Complaint Management System</p>
      </div>
    </div>
  </body>
  </html>`;

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"CampusFix" <${process.env.EMAIL_USER}>`,
      to,
      subject: `${emoji} Complaint ${complaintId} — Status Updated to ${status}`,
      html
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('📧 Email failed:', err.message);
  }
}

module.exports = { sendStatusUpdateEmail };
