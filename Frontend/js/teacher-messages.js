/* ===============================================
   TEACHER MESSAGES - Teacher/teacher-messages.html
   =============================================== */

// Filter conversations by tab
document.querySelectorAll('.conv-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.conv-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.conv-item').forEach(item => {
      const type = item.dataset.type;
      const isUnread = item.classList.contains('unread');
      if (filter === 'all') item.style.display = '';
      else if (filter === 'unread') item.style.display = isUnread ? '' : 'none';
      else if (filter === 'parent') item.style.display = type === 'parent' ? '' : 'none';
      else if (filter === 'staff') item.style.display = type === 'staff' ? '' : 'none';
      else if (filter === 'admin') item.style.display = (type === 'admin' || type === 'dos') ? '' : 'none';
    });
  });
});

// Search conversations
function filterConversations(q) {
  const lower = q.toLowerCase();
  document.querySelectorAll('.conv-item').forEach(item => {
    const name = item.dataset.name.toLowerCase();
    const preview = item.querySelector('.conv-preview').textContent.toLowerCase();
    item.style.display = (name.includes(lower) || preview.includes(lower)) ? '' : 'none';
  });
}

// Select a conversation
function selectConversation(el, name, type, initials, colorClass, isOnline) {
  document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  el.classList.remove('unread');
  const dot = el.querySelector('.unread-dot');
  if (dot) dot.remove();

  document.getElementById('threadName').childNodes[0].textContent = name + ' ';
  document.getElementById('threadAvatar').innerHTML =
    (isOnline ? '<div class="online-ring"></div>' : '') + initials;
  document.getElementById('threadAvatar').className = 'thread-head-avatar';

  const tag = document.getElementById('threadTypeTag');
  tag.textContent = type;
  tag.className = 'conv-type-tag ' + colorClass;

  const status = document.getElementById('threadStatus');
  if (isOnline) {
    status.innerHTML = '<span class="dot-online"></span> Active now';
    status.className = 'thread-head-status';
  } else {
    status.innerHTML = '<span class="dot-online"></span> Last seen recently';
    status.className = 'thread-head-status away';
  }

  // On mobile: hide conversation list, show thread
  document.getElementById('msgPageWrap').classList.remove('show-list');
}

// Send a message
function sendMessage() {
  const input = document.getElementById('composerInput');
  const text = input.value.trim();
  if (!text) return;

  const body = document.getElementById('threadBody');
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const row = document.createElement('div');
  row.className = 'msg-row sent';
  row.innerHTML = `
    <div class="msg-bubble">
      <p class="msg-text">${escapeHtml(text)}</p>
      <div class="msg-meta">
        <span class="msg-time">${time}</span>
        <span class="read-ticks">✓</span>
      </div>
    </div>`;
  body.appendChild(row);
  body.scrollTop = body.scrollHeight;
  input.value = '';
}

function handleComposerKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// Insert quick reply into composer
function insertQuickReply(text) {
  const input = document.getElementById('composerInput');
  input.value = text;
  input.focus();
}

// Mobile: show conversation list
function showConvList() {
  document.getElementById('msgPageWrap').classList.add('show-list');
}

function openNewMessage() {
  document.getElementById('composerInput').focus();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Scroll thread to bottom on load
window.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('threadBody');
  if (body) body.scrollTop = body.scrollHeight;
});
