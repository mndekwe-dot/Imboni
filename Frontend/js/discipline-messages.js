/* ================================================
   discipline-messages.js — Discipline Portal
   ================================================ */

document.querySelectorAll('.conv-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.conv-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.conv-item').forEach(item => {
      item.style.display = (filter === 'all' || item.dataset.type === filter) ? '' : 'none';
    });
  });
});

function filterConversations(q) {
  const lower = q.toLowerCase();
  document.querySelectorAll('.conv-item').forEach(item => {
    item.style.display = item.dataset.name.toLowerCase().includes(lower) ? '' : 'none';
  });
}

function selectConversation(el, name, type, initials, colorClass, isOnline) {
  document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  el.classList.remove('unread');
  const dot = el.querySelector('.unread-dot');
  if (dot) dot.remove();

  const avatar = document.getElementById('threadAvatar');
  avatar.className = 'thread-head-avatar';
  avatar.style.background = getAvatarColor(colorClass);
  avatar.childNodes[avatar.childNodes.length - 1].textContent = initials;

  document.getElementById('threadName').childNodes[0].textContent = name + ' ';
  const tag = document.getElementById('threadTypeTag');
  tag.textContent = type;
  tag.className = 'conv-type-tag ' + colorClass;

  const status = document.getElementById('threadStatus');
  const onlineRing = avatar.querySelector('div');
  if (isOnline) {
    status.innerHTML = '<span class="dot-online"></span> Active now';
    if (onlineRing) onlineRing.style.display = '';
  } else {
    status.innerHTML = 'Offline';
    if (onlineRing) onlineRing.style.display = 'none';
  }

  if (window.innerWidth <= 768) {
    document.getElementById('msgPageWrap').classList.remove('show-list');
    document.getElementById('convPanel').classList.remove('mobile-visible');
  }
}

function getAvatarColor(colorClass) {
  const colors = {
    matron:  '#8b5cf6',
    patron:  '#16a34a',
    student: '#0d9488',
    parent:  '#f97316',
    dos:     '#003d7a'
  };
  return colors[colorClass] || '#4f46e5';
}

function sendMessage() {
  const input = document.getElementById('composerInput');
  const text = input.value.trim();
  if (!text) return;
  const body = document.getElementById('threadBody');
  const row = document.createElement('div');
  row.className = 'msg-row sent';
  row.innerHTML = `<div class="msg-bubble"><p class="msg-text">${escapeHtml(text)}</p><div class="msg-meta"><span class="msg-time">${getTime()}</span><span class="read-ticks">✓✓</span></div></div>`;
  body.appendChild(row);
  body.scrollTop = body.scrollHeight;
  input.value = '';
}

function handleComposerKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function showConvList() {
  document.getElementById('msgPageWrap').classList.add('show-list');
  document.getElementById('convPanel').classList.add('mobile-visible');
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
