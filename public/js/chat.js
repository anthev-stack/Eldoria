import { getUser, onAuthChange } from './auth.js';

const config = window.ELDORIA_CONFIG;

function $(id) {
  return document.getElementById(id);
}

function apiBase() {
  return config.api?.baseUrl ?? '/api';
}

function headUrl(name) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function roleLabel(role) {
  const labels = { chief: 'Chief', admin: 'Admin', moderator: 'Mod', donator: 'Donator' };
  return labels[role] || '';
}

function renderMessage(msg) {
  const badge =
    msg.role && msg.role !== 'user'
      ? `<span class="chat-role role-badge role-${msg.role}">${roleLabel(msg.role)}</span>`
      : '';
  return `
    <div class="chat-message" data-id="${msg.id}">
      <img class="chat-avatar" src="${headUrl(msg.minecraftUsername)}" alt="" width="28" height="28" />
      <div class="chat-body">
        <div class="chat-meta">
          <span class="chat-name">${msg.minecraftUsername}</span>
          ${badge}
          <time class="chat-time">${formatTime(msg.createdAt)}</time>
        </div>
        <p class="chat-text">${escapeHtml(msg.message)}</p>
      </div>
    </div>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scrollChatToBottom() {
  const list = $('chat-messages');
  if (list) list.scrollTop = list.scrollHeight;
}

function renderMessages(messages) {
  const list = $('chat-messages');
  if (!list) return;
  list.innerHTML = messages.length
    ? messages.map(renderMessage).join('')
    : '<p class="chat-empty">No messages yet. Be the first to say hello!</p>';
  scrollChatToBottom();
}

function appendMessage(msg) {
  const list = $('chat-messages');
  if (!list) return;
  const empty = list.querySelector('.chat-empty');
  if (empty) empty.remove();
  if (list.querySelector(`[data-id="${msg.id}"]`)) return;
  list.insertAdjacentHTML('beforeend', renderMessage(msg));
  scrollChatToBottom();
}

function updateChatInputState() {
  const user = getUser();
  const input = $('chat-input');
  const send = $('chat-send');
  const hint = $('chat-hint');
  if (!input || !send) return;

  if (!user) {
    input.disabled = true;
    send.disabled = true;
    hint.textContent = 'Log in with Discord to chat';
    return;
  }
  if (!user.minecraftUsername) {
    input.disabled = true;
    send.disabled = true;
    hint.textContent = 'Set your Minecraft username to chat';
    return;
  }
  input.disabled = false;
  send.disabled = false;
  hint.textContent = `Chatting as ${user.minecraftUsername}`;
}

async function loadMessages() {
  try {
    const res = await fetch(`${apiBase()}/chat/messages`, { credentials: 'include' });
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderMessages(data.messages ?? []);
  } catch {
    $('chat-messages').innerHTML = '<p class="chat-empty">Could not load chat.</p>';
  }
}

async function sendMessage(text) {
  const res = await fetch(`${apiBase()}/chat/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send');
  return data.message;
}

function connectWebSocket() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'chat' && data.message) appendMessage(data.message);
    } catch {
      /* ignore */
    }
  });
  ws.addEventListener('close', () => {
    setTimeout(connectWebSocket, 3000);
  });
}

export function initChat() {
  const form = $('chat-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    try {
      const msg = await sendMessage(text);
      appendMessage(msg);
    } catch (err) {
      $('chat-hint').textContent = err.message;
    }
  });

  onAuthChange(updateChatInputState);

  loadMessages();
  connectWebSocket();
  updateChatInputState();
}
