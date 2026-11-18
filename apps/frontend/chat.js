// Chat UI for the MCP chat host (apps/host). No build step: edit and reload.
// The host is stateless – the UI keeps the conversation and sends it with every request.

import { renderMarkdown } from './markdown.js';

const messagesEl = document.querySelector('#messages');
const form = document.querySelector('#form');
const input = document.querySelector('#input');
const sendButton = document.querySelector('#send');

/** @type {{ role: 'user' | 'assistant', content: string }[]} */
let history = [];

loadStatus();
listenForTheme();

form.addEventListener('submit', event => {
  event.preventDefault();
  send();
});

input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

document.querySelector('#reset').addEventListener('click', () => {
  history = [];
  messagesEl.replaceChildren();
  input.focus();
});

async function send() {
  const text = input.value.trim();
  if (!text || sendButton.disabled) return;
  input.value = '';
  history.push({ role: 'user', content: text });
  addMessage('user', text);
  const pending = addMessage('assistant pending', 'Denke nach …');
  setBusy(true);

  try {
    const response = await fetch('api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    const data = await response.json();
    pending.remove();
    if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
    history.push({ role: 'assistant', content: data.answer });
    const message = addMessage('assistant markdown', '');
    message.append(renderMarkdown(data.answer || '(keine Antwort)'));
    if (data.steps.length > 0) message.append(renderSteps(data.steps));
  } catch (error) {
    pending.remove();
    history.pop(); // let the user retry the same question
    addMessage('error', `Fehler: ${error.message}`);
  } finally {
    setBusy(false);
    input.focus();
  }
}

/** Shows which MCP tools were called – the core of the MCP flow. */
function renderSteps(steps) {
  const container = document.createElement('div');
  container.className = 'steps';
  for (const step of steps) {
    const details = document.createElement('details');
    details.className = step.isError ? 'step failed' : 'step';
    const summary = document.createElement('summary');
    summary.textContent = `${step.isError ? '⚠' : '🔧'} ${step.tool}`;
    details.append(
      summary,
      labeledPre('Argumente', JSON.stringify(step.arguments, null, 2)),
      labeledPre('Ergebnis', prettyJson(step.result)),
    );
    container.append(details);
  }
  return container;
}

function labeledPre(label, text) {
  const pre = document.createElement('pre');
  pre.textContent = `${label}:\n${text}`;
  return pre;
}

function prettyJson(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function addMessage(kind, text) {
  messagesEl.querySelector('.hint')?.remove();
  const el = document.createElement('div');
  el.className = `message ${kind}`;
  el.textContent = text; // textContent: never render model output as HTML
  messagesEl.append(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

function setBusy(busy) {
  sendButton.disabled = busy;
}

/**
 * Inside ERPNext the launcher (erpnext-launcher.js) sends ERPNext's theme so the chat uses the same
 * colours: { type: 'mcp-chat-theme', theme: 'light' | 'dark', vars: { '--bg': '#fff', ... } }.
 * Only the embedding page may send it (who may embed the chat is limited by the host's CSP).
 */
const THEME_VARS = ['--bg', '--surface', '--text', '--muted', '--border', '--accent', '--accent-text',
  '--user-bg', '--error', '--error-bg', '--code-bg', '--radius', '--font'];

function listenForTheme() {
  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window.parent || window.parent === window || data?.type !== 'mcp-chat-theme') return;
    const root = document.documentElement;
    root.dataset.theme = data.theme === 'dark' ? 'dark' : 'light';
    for (const name of THEME_VARS) {
      const value = data.vars?.[name];
      // Plain values only: no url() or other tricks to load resources.
      if (typeof value === 'string' && value && value.length < 300 && !/[;{}<>]|url\(/i.test(value)) {
        root.style.setProperty(name, value);
      } else {
        root.style.removeProperty(name);
      }
    }
  });
}

async function loadStatus() {
  const modelEl = document.querySelector('#model');
  const list = document.querySelector('#server-list');
  try {
    const status = await (await fetch('api/status')).json();
    modelEl.textContent = `Modell: ${status.model}`;
    list.replaceChildren(...status.servers.map(server => {
      const li = document.createElement('li');
      if (server.connected) {
        const tools = status.tools.filter(tool => tool.server === server.name).map(tool => tool.name);
        li.innerHTML = `<strong></strong> – ${server.toolCount} Tool(s): <code></code>`;
        li.querySelector('strong').textContent = server.name;
        li.querySelector('code').textContent = tools.join(', ');
      } else {
        li.className = 'down';
        li.textContent = `${server.name} – nicht verbunden: ${server.error ?? 'unbekannter Fehler'}`;
      }
      return li;
    }));
    const connected = status.servers.filter(server => server.connected).length;
    document.querySelector('#servers summary').textContent = `MCP-Server (${connected}/${status.servers.length} verbunden)`;
  } catch {
    modelEl.textContent = 'Host nicht erreichbar';
  }
}
