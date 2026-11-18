// Floating chat button for the ERPNext desk. ERPNext loads this file on every desk page via
// `app_include_js` in the site config (scripts/setup-chat-widget.sh). It only adds a button and
// a popup; the chat itself is the normal chat UI (index.html) inside an iframe.
(() => {
  if (window.top !== window || document.getElementById('mcp-chat-launcher')) return;

  // The chat lives next to this script on the chat host, e.g. http://localhost:3000/
  const chatUrl = new URL('.', document.currentScript.src).href;

  const style = document.createElement('style');
  style.textContent = `
    #mcp-chat-launcher {
      position: fixed; right: 24px; bottom: 24px; z-index: 1050;
      width: 56px; height: 56px; border: 0; border-radius: 50%;
      background: #2490ef; color: #fff; cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, .25);
      display: flex; align-items: center; justify-content: center;
    }
    #mcp-chat-launcher:hover { background: #1a7fd9; }
    #mcp-chat-launcher:focus-visible { outline: 3px solid #9ccbf7; outline-offset: 2px; }
    #mcp-chat-popup {
      position: fixed; right: 24px; bottom: 92px; z-index: 1050;
      width: min(420px, calc(100vw - 32px)); height: min(640px, calc(100vh - 120px));
      border-radius: 12px; overflow: hidden; background: #fff;
      box-shadow: 0 8px 32px rgba(0, 0, 0, .3);
    }
    #mcp-chat-popup[hidden] { display: none; }
    #mcp-chat-popup iframe { width: 100%; height: 100%; border: 0; display: block; }
  `;

  const chatIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const closeIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  const button = document.createElement('button');
  button.id = 'mcp-chat-launcher';
  button.type = 'button';
  button.setAttribute('aria-controls', 'mcp-chat-popup');

  const popup = document.createElement('div');
  popup.id = 'mcp-chat-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'MCP Chat');
  popup.hidden = true;

  function setOpen(open) {
    // Load the chat on first open only; afterwards keep the iframe so the conversation survives.
    if (open && !popup.firstChild) {
      const iframe = document.createElement('iframe');
      iframe.src = chatUrl;
      iframe.title = 'MCP Chat';
      popup.append(iframe);
    }
    popup.hidden = !open;
    button.innerHTML = open ? closeIcon : chatIcon;
    button.title = open ? 'Chat schließen' : 'Chat öffnen';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-expanded', String(open));
  }

  button.addEventListener('click', () => setOpen(popup.hidden));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !popup.hidden) setOpen(false);
  });

  setOpen(false);
  document.head.append(style);
  document.body.append(popup, button);
})();
