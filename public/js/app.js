document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-copy-link]').forEach((button) => {
    button.addEventListener('click', async () => {
      const link = button.getAttribute('data-copy-link') || window.location.href;
      try {
        await navigator.clipboard.writeText(link);
        const original = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = original;
        }, 1600);
      } catch (err) {
        window.prompt('Copy this link:', link);
      }
    });
  });

  const photoInput = document.querySelector('#photoInput');
  const photoPreview = document.querySelector('#photoPreview');
  if (photoInput && photoPreview) {
    photoInput.addEventListener('change', () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) {
        photoPreview.src = '';
        photoPreview.classList.add('d-none');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        photoPreview.src = reader.result;
        photoPreview.classList.remove('d-none');
      };
      reader.readAsDataURL(file);
    });
  }

  const themeToggle = document.querySelector('[data-theme-toggle]');
  const storedTheme = localStorage.getItem('campus-theme');
  if (storedTheme === 'dark') {
    document.body.classList.add('theme-dark');
  }

  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    const syncIcon = () => {
      if (!icon) return;
      if (document.body.classList.contains('theme-dark')) {
        icon.classList.remove('bi-moon-stars');
        icon.classList.add('bi-sun');
      } else {
        icon.classList.remove('bi-sun');
        icon.classList.add('bi-moon-stars');
      }
    };

    syncIcon();

    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('theme-dark');
      localStorage.setItem(
        'campus-theme',
        document.body.classList.contains('theme-dark') ? 'dark' : 'light'
      );
      syncIcon();
    });
  }

  document.querySelectorAll('.reveal').forEach((el, idx) => {
    setTimeout(() => {
      el.classList.add('reveal--visible');
    }, idx * 80 + 120);
  });

  // --- Chat & Notification Logic ---
  const userId = document.body.dataset.userId;
  const userName = document.body.dataset.userName || 'User';

  // Chat DOM references (used for gating chat stream)
  const chatContainer = document.getElementById('chat-container');
  const openChatBtn = document.getElementById('open-chat-btn');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatOverlay = document.getElementById('chat-overlay');
  const popupChatForm = document.getElementById('popup-chat-form');
  const chatShell = document.querySelector('.chat-shell');
  const isChatRoute = window.location.pathname.startsWith('/chat');
  const shouldEnableChat = Boolean(userId);

  // Exit if EventSource is not available, user is not logged in, or chat UI is not present.
  if (typeof EventSource === 'undefined' || !userId || !shouldEnableChat) {
    return;
  }

  // --- 1. Establish a single, reusable SSE connection ---
  const existingStream = window.__campusChatStream;
  const stream = existingStream || new EventSource('/chat/stream');
  if (!existingStream) {
    window.__campusChatStream = stream;
  }

  // --- 2. Helper Functions ---

  function updateUnreadBadge(senderId) {
    const listItem = document.querySelector(`.chat-list__item[data-user-id="${senderId}"]`);
    if (!listItem) return;
    let badge = listItem.querySelector('.chat-unread');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'chat-unread';
      badge.textContent = '1';
      const meta = listItem.querySelector('.chat-meta');
      if (meta) {
        meta.appendChild(badge);
      } else {
        listItem.appendChild(badge);
      }
      return;
    }
    const current = parseInt(badge.textContent || '0', 10);
    badge.textContent = String(current + 1);
  }

  function updateConversationPreview(senderId, message, createdAt) {
    const listItem = document.querySelector(`.chat-list__item[data-user-id="${senderId}"]`);
    if (!listItem) return;
    const preview = listItem.querySelector('p.text-muted');
    if (preview) preview.textContent = message;
    const date = listItem.querySelector('.chat-meta small');
    if (date && createdAt) {
      const dateObj = new Date(createdAt);
      date.textContent = dateObj.toLocaleDateString();
    }
  }

  async function markConversationRead(otherId) {
    try {
      await fetch('/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherId })
      });
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  }

  function setTypingIndicator(targetId, isTyping, isPopup) {
    const el = isPopup ? document.getElementById('chat-popup-typing') : document.getElementById('chat-typing');
    if (!el || !targetId) return;
    if (isTyping) {
      el.classList.add('is-active');
    } else {
      el.classList.remove('is-active');
    }
  }

  async function sendTyping(recipientId, isTyping) {
    if (!recipientId) return;
    try {
      await fetch(isTyping ? '/chat/typing' : '/chat/stop-typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId })
      });
    } catch (err) {
      console.error('Typing update failed', err);
    }
  }

  /**
   * Appends a chat message to the chat box UI.
   */
  function appendChatMessage(sender, message) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const messageElement = document.createElement('div');
    const isMe = sender === 'You' || String(sender) === String(userId);
    messageElement.className = `message-wrapper ${isMe ? 'sent' : 'received'}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = message;

    messageElement.appendChild(bubble);
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  /**
   * Persists a message to the server.
   */
  async function sendMessage(recipientId, recipientName, message) {
    try {
      await fetch('/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          recipientName,
          content: message,
        }),
      });
    } catch (err) {
      console.error('Failed to save message', err);
      alert('Could not send message. Please try again.');
      return;
    }
  }

  /**
   * Fetches and displays chat history.
   */
  async function loadChatHistory(recipientId) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    chatBox.innerHTML = '<div class="d-flex justify-content-center my-4"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div></div>';

    try {
      const response = await fetch(`/chat/history/${recipientId}`);
      if (response.ok) {
        const messages = await response.json();
        chatBox.innerHTML = '';
        messages.forEach(msg => appendChatMessage(msg.sender, msg.message));
      } else {
        chatBox.innerHTML = '<div class="text-center text-muted small my-3">Start the conversation...</div>';
      }
    } catch (error) {
      chatBox.innerHTML = '<div class="text-center text-danger small my-3">Could not load history.</div>';
    }
  }

  // --- 3. Global SSE Event Listeners ---

  stream.addEventListener('typing', (event) => {
    const data = JSON.parse(event.data || '{}');
    const pathParts = window.location.pathname.split('/');
    const isChatPage = pathParts.length > 2 && pathParts[1] === 'chat';
    const activeChatId = isChatPage ? pathParts[2] : null;
    const isPopupActive = chatContainer && chatContainer.classList.contains('is-open');
    const popupChatId = isPopupActive ? chatContainer.dataset.recipientId : null;

    if (activeChatId && String(activeChatId) === String(data.senderId)) {
      setTypingIndicator(activeChatId, true, false);
    }

    if (popupChatId && String(popupChatId) === String(data.senderId)) {
      setTypingIndicator(popupChatId, true, true);
    }
  });

  stream.addEventListener('stop-typing', (event) => {
    const data = JSON.parse(event.data || '{}');
    const pathParts = window.location.pathname.split('/');
    const isChatPage = pathParts.length > 2 && pathParts[1] === 'chat';
    const activeChatId = isChatPage ? pathParts[2] : null;
    const isPopupActive = chatContainer && chatContainer.classList.contains('is-open');
    const popupChatId = isPopupActive ? chatContainer.dataset.recipientId : null;

    if (activeChatId && String(activeChatId) === String(data.senderId)) {
      setTypingIndicator(activeChatId, false, false);
    }

    if (popupChatId && String(popupChatId) === String(data.senderId)) {
      setTypingIndicator(popupChatId, false, true);
    }
  });

  stream.addEventListener('chat-message', (event) => {
    const data = JSON.parse(event.data || '{}');

    const pathParts = window.location.pathname.split('/');
    let activeChatId = null;

    if (pathParts.length > 2 && pathParts[1] === 'chat') {
      activeChatId = pathParts[2];
    } else if (chatContainer && chatContainer.classList.contains('is-open')) {
      activeChatId = chatContainer.dataset.recipientId;
    }

    if (activeChatId && String(data.sender) === String(activeChatId)) {
      const chatBox = document.getElementById('chat-box');
      if (chatBox) {
        appendChatMessage(data.sender, data.message);
      }
      markConversationRead(activeChatId);
    } else {
      updateUnreadBadge(data.sender);
      const chatNavLink = document.getElementById('chat-nav-link');
      if (chatNavLink && !document.getElementById('chat-notification-badge')) {
        const badge = document.createElement('span');
        badge.id = 'chat-notification-badge';
        badge.className = 'notification-dot';
        chatNavLink.appendChild(badge);
      }
    }

    updateConversationPreview(data.sender, data.message, data.createdAt);
  });

  // --- 4. Page-Specific Logic ---

  if (window.location.pathname.startsWith('/chat')) {
    const badge = document.getElementById('chat-notification-badge');
    if (badge) badge.remove();
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 2) {
      markConversationRead(pathParts[2]);
    }
  }

  const chatForm = document.getElementById('chat-form');
  if (chatForm) {
    const messageInput = document.getElementById('message');
    const chatBox = document.getElementById('chat-box');

    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

    let typingTimeout;
    messageInput.addEventListener('input', () => {
      const pathParts = window.location.pathname.split('/');
      const recipientId = pathParts.length > 2 && pathParts[1] === 'chat' ? pathParts[2] : null;
      if (!recipientId) return;
      sendTyping(recipientId, true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        sendTyping(recipientId, false);
      }, 1200);
    });

    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = messageInput.value.trim();
      const pathParts = window.location.pathname.split('/');
      const recipientId = pathParts.length > 2 && pathParts[1] === 'chat' ? pathParts[2] : null;

      if (!message || !recipientId) return;

      const recipientName = document.querySelector('#chat-with')?.textContent.replace('Chat with ', '') || 'User';

      await sendMessage(recipientId, recipientName, message);
      appendChatMessage('You', message);
      messageInput.value = '';
    });
  }

  // --- 5. Chat Popup Logic ---

  if (openChatBtn && chatContainer) {
    openChatBtn.addEventListener('click', () => {
      const recipientId = openChatBtn.dataset.recipientId;
      const recipientName = openChatBtn.dataset.recipientName;

      if (!recipientId || !recipientName) {
        console.error('Chat button is missing data-recipient-id or data-recipient-name attributes.');
        alert('Cannot initiate chat. Recipient information is missing.');
        return;
      }

      chatContainer.dataset.recipientId = recipientId;
      chatContainer.dataset.recipientName = recipientName;

      const popupTitle = chatContainer.querySelector('.chat-popup-header h5');
      if (popupTitle) popupTitle.textContent = `Chat with ${recipientName}`;

      loadChatHistory(recipientId);
      markConversationRead(recipientId);

      chatContainer.classList.add('is-open');
      document.body.classList.add('chat-open');
    });
  }

  if (popupChatForm && chatContainer) {
    const popupMsgInput = popupChatForm.querySelector('[name="message"]');
    if (popupMsgInput && !popupMsgInput.parentNode.querySelector('.char-counter')) {
      const maxLength = 300;
      popupMsgInput.maxLength = maxLength;
      const counter = document.createElement('div');
      counter.className = 'text-end text-muted mt-1 small char-counter';
      counter.textContent = `0/${maxLength}`;
      popupMsgInput.parentNode.appendChild(counter);
      popupMsgInput.addEventListener('input', () => {
        counter.textContent = `${popupMsgInput.value.length}/${maxLength}`;
      });
    }

    let popupTypingTimeout;
    popupMsgInput.addEventListener('input', () => {
      const { recipientId } = chatContainer.dataset;
      if (!recipientId) return;
      sendTyping(recipientId, true);
      clearTimeout(popupTypingTimeout);
      popupTypingTimeout = setTimeout(() => {
        sendTyping(recipientId, false);
      }, 1200);
    });

    popupChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = popupMsgInput.value.trim();
      const { recipientId, recipientName } = chatContainer.dataset;

      if (!message || !recipientId) return;

      await sendMessage(recipientId, recipientName, message);
      appendChatMessage('You', message);

      popupMsgInput.value = '';
      const counter = popupMsgInput.parentNode.querySelector('.char-counter');
      if (counter) {
        counter.textContent = `0/${popupMsgInput.maxLength}`;
      }
    });
  }

  const closeChat = () => {
    if (chatContainer) {
      chatContainer.classList.remove('is-open');
      document.body.classList.remove('chat-open');
    }
  };
  if (closeChatBtn) closeChatBtn.addEventListener('click', closeChat);
  if (chatOverlay) chatOverlay.addEventListener('click', closeChat);
});
