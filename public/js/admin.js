// ===== CAMPUSFIX v2.0 — ADMIN PANEL =====
const ICONS = { Hostel:'🏠', Classroom:'🏫', Electricity:'💡', Water:'💧', Internet:'🌐', Cleanliness:'🧹' };
let currentComplaintId = null;

// Dark mode
const savedTheme = localStorage.getItem('cf-theme') || 'light';
if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme','dark');
function toggleDark() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('cf-theme', isDark ? 'light' : 'dark');
  document.getElementById('dark-btn').textContent = isDark ? '🌙' : '☀️';
}
document.addEventListener('DOMContentLoaded', () => {
  if (savedTheme === 'dark') document.getElementById('dark-btn').textContent = '☀️';
});

window.addEventListener('DOMContentLoaded', async () => {
  const s = await fetch('/api/auth/session').then(r => r.json());
  if (!s.loggedIn || s.role !== 'admin') { window.location.href = '/'; return; }
  loadAdminDashboard();
});

function switchAdminView(view, el) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('admin-view-' + view).classList.add('active');
  if (el) el.classList.add('active');
  const titles = { dashboard: 'Admin Dashboard', complaints: 'All Complaints' };
  document.getElementById('admin-page-title').textContent = titles[view] || view;
  if (view === 'complaints') loadAdminComplaints();
  return false;
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

async function loadAdminDashboard() {
  const [stats, complaints] = await Promise.all([
    fetch('/api/complaints/stats').then(r => r.json()),
    fetch('/api/complaints/all').then(r => r.json())
  ]);
  document.getElementById('a-stat-total').textContent = stats.total;
  document.getElementById('a-stat-pending').textContent = stats.pending;
  document.getElementById('a-stat-inprogress').textContent = stats.inProgress;
  document.getElementById('a-stat-resolved').textContent = stats.resolved;

  const badge = document.getElementById('a-pending-badge');
  if (stats.pending > 0) { badge.textContent = stats.pending; badge.style.display = ''; }
  else badge.style.display = 'none';

  // Category chart
  const catHtml = (stats.byCategory || []).map(d => `
    <div class="bar-row">
      <div class="bar-label">${ICONS[d.category]||''} ${d.category}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${stats.total ? (d.count/stats.total*100).toFixed(1) : 0}%"></div></div>
      <div class="bar-val">${d.count}</div>
    </div>`).join('') || '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">No data yet</p>';
  document.getElementById('cat-chart').innerHTML = catHtml;

  // Priority chart
  const byPri = stats.byPriority || [];
  const hi = byPri.find(p => p.priority === 'High')?.count || 0;
  const me = byPri.find(p => p.priority === 'Medium')?.count || 0;
  const lo = byPri.find(p => p.priority === 'Low')?.count || 0;
  document.getElementById('high-count').textContent = hi;
  document.getElementById('med-count').textContent = me;
  document.getElementById('low-count').textContent = lo;

  document.getElementById('admin-recent-list').innerHTML = renderAdminComplaints(complaints.slice(0, 8));
}

async function loadAdminComplaints() {
  const search = document.getElementById('a-search')?.value.trim() || '';
  const status = document.getElementById('a-status')?.value || '';
  const priority = document.getElementById('a-priority')?.value || '';
  const category = document.getElementById('a-category')?.value || '';
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  if (priority) params.append('priority', priority);
  if (category) params.append('category', category);
  const complaints = await fetch('/api/complaints/all?' + params).then(r => r.json());
  document.getElementById('admin-complaints-list').innerHTML = renderAdminComplaints(complaints, true);
}

function renderAdminComplaints(list, showStudent = false) {
  if (!list.length) return `<div class="empty-state"><div class="empty-icon">📭</div><p>No complaints found</p><span>Try adjusting filters</span></div>`;
  return list.map(c => `
    <div class="complaint-card" onclick='openAdminModal(${JSON.stringify(c)})'>
      <div class="complaint-cat-icon">${ICONS[c.category]||'📋'}</div>
      <div class="complaint-body">
        <div class="complaint-top">
          <span class="c-title">${esc(c.title)}</span>
          <span class="c-id">${c.complaint_id}</span>
        </div>
        <div class="c-desc">${esc(c.description)}</div>
        <div class="complaint-tags">
          <span class="tag-cat">${c.category}</span>
          <span class="status-badge status-${c.status.replace(' ','-')}">${c.status}</span>
          <span class="priority-badge priority-${c.priority||'Medium'}">${priEmoji(c.priority)} ${c.priority||'Medium'}</span>
          ${showStudent && c.student_name ? `<span class="tag-location">👤 ${esc(c.student_name)}${c.roll_number?' · '+c.roll_number:''}</span>` : ''}
          ${c.location ? `<span class="tag-location">📍 ${esc(c.location)}</span>` : ''}
          <span class="tag-date">${fmtDate(c.created_at)}</span>
        </div>
      </div>
    </div>`).join('');
}

function openAdminModal(c) {
  currentComplaintId = c.complaint_id;
  document.getElementById('am-title').textContent = c.title;
  document.getElementById('am-id').textContent = c.complaint_id;
  document.getElementById('am-student').textContent = `${c.student_name||'Unknown'}${c.roll_number?' ('+c.roll_number+')':''}`;
  document.getElementById('am-dept').textContent = c.department || '—';
  document.getElementById('am-category').textContent = `${ICONS[c.category]||''} ${c.category}`;
  document.getElementById('am-priority').innerHTML = `<span class="priority-badge priority-${c.priority||'Medium'}">${priEmoji(c.priority)} ${c.priority||'Medium'}</span>`;
  document.getElementById('am-date').textContent = fmtDate(c.created_at);
  document.getElementById('am-location').textContent = c.location || '—';
  document.getElementById('am-desc').textContent = c.description;
  document.getElementById('am-status').value = c.status;
  document.getElementById('am-note').value = c.admin_note || '';
  const imgRow = document.getElementById('am-img-row');
  if (c.image_path) { imgRow.classList.remove('hidden'); document.getElementById('am-img').src = c.image_path; }
  else imgRow.classList.add('hidden');
  document.getElementById('admin-modal').classList.remove('hidden');
}

function closeAdminModal() { document.getElementById('admin-modal').classList.add('hidden'); currentComplaintId = null; }
document.getElementById('admin-modal').addEventListener('click', e => { if (e.target.id === 'admin-modal') closeAdminModal(); });

async function updateStatus() {
  if (!currentComplaintId) return;
  const status = document.getElementById('am-status').value;
  const admin_note = document.getElementById('am-note').value.trim();
  const btn = document.querySelector('#admin-modal .btn-primary');
  btn.disabled = true; btn.innerHTML = '<span>Updating...</span>';
  const res = await fetch(`/api/complaints/${currentComplaintId}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, admin_note })
  });
  const data = await res.json();
  btn.disabled = false; btn.innerHTML = '✓ Update Status';
  if (res.ok) {
    showToast(`✅ Status updated to "${status}"`, 'success');
    closeAdminModal(); refreshView();
  } else showToast(data.error || 'Failed', 'error');
}

async function deleteComplaint() {
  if (!currentComplaintId || !confirm(`Delete ${currentComplaintId}? This cannot be undone.`)) return;
  const res = await fetch(`/api/complaints/${currentComplaintId}`, { method: 'DELETE' });
  const data = await res.json();
  if (res.ok) { showToast('Complaint deleted', 'success'); closeAdminModal(); refreshView(); }
  else showToast(data.error || 'Failed', 'error');
}

function refreshView() {
  const active = document.querySelector('.view.active');
  if (active.id === 'admin-view-dashboard') loadAdminDashboard();
  else loadAdminComplaints();
}

function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast toast-${type}`;
  setTimeout(() => t.className = 'toast hidden', 3500);
}
async function handleLogout() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function priEmoji(p) { return p === 'High' ? '🔴' : p === 'Low' ? '🟢' : '🟡'; }
