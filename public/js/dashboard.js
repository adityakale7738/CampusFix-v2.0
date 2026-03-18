// ===== CAMPUSFIX v2.0 — STUDENT DASHBOARD =====
let allComplaints = [];
const ICONS = { Hostel:'🏠', Classroom:'🏫', Electricity:'💡', Water:'💧', Internet:'🌐', Cleanliness:'🧹' };

// Dark mode
const savedTheme = localStorage.getItem('cf-theme') || 'light';
if (savedTheme === 'dark') { document.documentElement.setAttribute('data-theme','dark'); }
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
  if (!s.loggedIn || s.role !== 'student') { window.location.href = '/'; return; }
  document.getElementById('sidebar-name').textContent = s.name;
  document.getElementById('welcome-name').textContent = `Good day, ${s.name.split(' ')[0]}! 👋`;
  document.getElementById('user-av').textContent = s.name.charAt(0).toUpperCase();
  loadOverview();
  loadProfile();
});

function switchView(view, el) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  if (el) el.classList.add('active');
  const titles = { overview: 'Overview', submit: 'New Complaint', mycomplaints: 'My Complaints', profile: 'My Profile' };
  document.getElementById('page-title').textContent = titles[view] || view;
  if (view === 'mycomplaints') loadAllComplaints();
  if (view === 'overview') loadOverview();
  return false;
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

async function loadOverview() {
  const complaints = await fetch('/api/complaints/my').then(r => r.json());
  allComplaints = complaints;
  const s = { total: complaints.length, pending: 0, inProgress: 0, resolved: 0 };
  complaints.forEach(c => {
    if (c.status === 'Pending') s.pending++;
    else if (c.status === 'In Progress') s.inProgress++;
    else if (c.status === 'Resolved') s.resolved++;
  });
  document.getElementById('stat-total').textContent = s.total;
  document.getElementById('stat-pending').textContent = s.pending;
  document.getElementById('stat-inprogress').textContent = s.inProgress;
  document.getElementById('stat-resolved').textContent = s.resolved;
  document.getElementById('welcome-sub').textContent = `${s.pending} pending · ${s.inProgress} in progress · ${s.resolved} resolved`;
  const badge = document.getElementById('pending-badge');
  if (s.pending > 0) { badge.textContent = s.pending; badge.style.display = ''; }
  else badge.style.display = 'none';
  document.getElementById('recent-list').innerHTML = renderComplaints(complaints.slice(0,5), 'No complaints yet. Submit your first one!');
}

async function loadAllComplaints() {
  const complaints = await fetch('/api/complaints/my').then(r => r.json());
  allComplaints = complaints;
  document.getElementById('all-list').innerHTML = renderComplaints(complaints, 'No complaints found.');
}

function filterComplaints() {
  const search = document.getElementById('f-search').value.toLowerCase();
  const status = document.getElementById('f-status').value;
  const priority = document.getElementById('f-priority').value;
  let f = allComplaints;
  if (status) f = f.filter(c => c.status === status);
  if (priority) f = f.filter(c => c.priority === priority);
  if (search) f = f.filter(c => c.title.toLowerCase().includes(search) || c.complaint_id.toLowerCase().includes(search));
  document.getElementById('all-list').innerHTML = renderComplaints(f, 'No matching complaints.');
}

function renderComplaints(list, emptyMsg) {
  if (!list.length) return `<div class="empty-state"><div class="empty-icon">📭</div><p>${emptyMsg}</p><span>Your complaints will appear here</span></div>`;
  return list.map(c => `
    <div class="complaint-card" onclick="openModal('${c.complaint_id}')">
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
          <span class="priority-badge priority-${c.priority||'Medium'}">${priorityEmoji(c.priority)} ${c.priority||'Medium'}</span>
          ${c.location ? `<span class="tag-location">📍 ${esc(c.location)}</span>` : ''}
          <span class="tag-date">${fmtDate(c.created_at)}</span>
        </div>
      </div>
    </div>`).join('');
}

async function openModal(id) {
  const c = await fetch(`/api/complaints/my/${id}`).then(r => r.json());
  if (c.error) return;
  document.getElementById('m-title').textContent = c.title;
  document.getElementById('m-id').textContent = c.complaint_id;
  document.getElementById('m-category').textContent = `${ICONS[c.category]||''} ${c.category}`;
  document.getElementById('m-status').innerHTML = `<span class="status-badge status-${c.status.replace(' ','-')}">${c.status}</span>`;
  document.getElementById('m-priority').innerHTML = `<span class="priority-badge priority-${c.priority||'Medium'}">${priorityEmoji(c.priority)} ${c.priority||'Medium'}</span>`;
  document.getElementById('m-date').textContent = fmtDate(c.created_at);
  document.getElementById('m-desc').textContent = c.description;
  const locRow = document.getElementById('m-loc-row');
  if (c.location) { locRow.classList.remove('hidden'); document.getElementById('m-location').textContent = c.location; }
  else locRow.classList.add('hidden');
  const noteRow = document.getElementById('m-note-row');
  if (c.admin_note) { noteRow.classList.remove('hidden'); document.getElementById('m-note').textContent = c.admin_note; }
  else noteRow.classList.add('hidden');
  const imgRow = document.getElementById('m-img-row');
  if (c.image_path) { imgRow.classList.remove('hidden'); document.getElementById('m-img').src = c.image_path; }
  else imgRow.classList.add('hidden');
  document.getElementById('detail-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('detail-modal').classList.add('hidden'); }
document.getElementById('detail-modal').addEventListener('click', e => { if (e.target.id === 'detail-modal') closeModal(); });

function selectCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('sel-category').value = btn.dataset.cat;
}

function selectPri(btn) {
  document.querySelectorAll('.pri-btn').forEach(b => { b.className = 'pri-btn'; });
  const pri = btn.dataset.pri;
  btn.classList.add(`sel-${pri.toLowerCase()}`);
  document.getElementById('sel-priority').value = pri;
}

document.getElementById('c-desc').addEventListener('input', function () {
  document.getElementById('char-count').textContent = `${this.value.length} / 500`;
});

function previewImg(input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('upload-placeholder').classList.add('hidden');
    document.getElementById('upload-preview').classList.remove('hidden');
  };
  reader.readAsDataURL(input.files[0]);
}
function clearImg(e) {
  e.stopPropagation();
  document.getElementById('file-input').value = '';
  document.getElementById('upload-placeholder').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
}

async function submitComplaint() {
  const title = document.getElementById('c-title').value.trim();
  const category = document.getElementById('sel-category').value;
  const priority = document.getElementById('sel-priority').value || 'Medium';
  const description = document.getElementById('c-desc').value.trim();
  const location = document.getElementById('c-location').value.trim();
  const errEl = document.getElementById('submit-error');
  const sucEl = document.getElementById('submit-success');
  errEl.className = 'alert hidden'; sucEl.className = 'alert hidden';
  if (!category) { errEl.textContent = 'Please select a category.'; errEl.className = 'alert alert-error'; return; }
  if (!title) { errEl.textContent = 'Please enter a complaint title.'; errEl.className = 'alert alert-error'; return; }
  if (!description) { errEl.textContent = 'Please describe the issue.'; errEl.className = 'alert alert-error'; return; }
  const btn = document.querySelector('.btn-submit');
  btn.disabled = true; btn.innerHTML = '<span>Submitting...</span>';
  const fd = new FormData();
  fd.append('title', title); fd.append('category', category);
  fd.append('priority', priority); fd.append('description', description);
  if (location) fd.append('location', location);
  const fi = document.getElementById('file-input');
  if (fi.files[0]) fd.append('image', fi.files[0]);
  try {
    const res = await fetch('/api/complaints/submit', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; errEl.className = 'alert alert-error'; }
    else {
      sucEl.textContent = `✅ Complaint submitted! Your ID: ${data.complaintId}`;
      sucEl.className = 'alert alert-success';
      document.getElementById('c-title').value = '';
      document.getElementById('c-desc').value = '';
      document.getElementById('c-location').value = '';
      document.getElementById('sel-category').value = '';
      document.getElementById('sel-priority').value = 'Medium';
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
      document.querySelectorAll('.pri-btn').forEach(b => b.className = 'pri-btn');
      clearImg({ stopPropagation: () => {} });
      document.getElementById('char-count').textContent = '0 / 500';
      setTimeout(() => switchView('mycomplaints', document.querySelector('[data-view=mycomplaints]')), 2000);
    }
  } catch (e) { errEl.textContent = 'Network error. Try again.'; errEl.className = 'alert alert-error'; }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit Complaint';
  }
}

async function loadProfile() {
  const user = await fetch('/api/auth/profile').then(r => r.json());
  document.getElementById('profile-content').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="detail-grid">
        <div class="detail-item"><label>Full Name</label><span>${esc(user.name)}</span></div>
        <div class="detail-item"><label>Email</label><span>${esc(user.email)}</span></div>
        <div class="detail-item"><label>Roll Number</label><span>${user.roll_number || '—'}</span></div>
        <div class="detail-item"><label>Department</label><span>${user.department || '—'}</span></div>
        <div class="detail-item"><label>Phone</label><span>${user.phone || '—'}</span></div>
        <div class="detail-item"><label>Member Since</label><span>${fmtDate(user.created_at)}</span></div>
      </div>
    </div>`;
}

async function handleLogout() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function priorityEmoji(p) { return p === 'High' ? '🔴' : p === 'Low' ? '🟢' : '🟡'; }
function showToast(msg, type='default') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast toast-${type}`;
  setTimeout(() => t.className = 'toast hidden', 3000);
}
