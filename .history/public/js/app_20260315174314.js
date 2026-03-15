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

  // Exit if Socket.IO is not loaded or user is not logged in
  if (typeof io === 'undefined' || !userId) {
    return;
  }

  // --- 1. Establish a single, reusable socket connection ---
  const socket = io();
  socket.emit('user online', userId);

  // --- 2. Helper Functions ---

  /**
   * Appends a chat message to the chat box UI.
   * Differentiates between sent ('You') and received (sender's ID) messages.
   */
  function appendChatMessage(sender, message) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const messageElement = document.createElement('div');
    // 'sender' will be 'You' for outgoing, or the sender's ID for incoming.
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
   * Persists a message to the server and emits it via socket.
   */
  async function sendMessage(recipientId, recipientName, message) {
    const data = { sender: userId, senderName: userName, recipient: recipientId, message };

    // a. Persist message via API
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
      return; // Stop if saving failed
    }

    // b. Emit for real-time delivery
    socket.emit('chat message', data);
  }

  /**
   * Fetches and displays chat history.
   */
  async function loadChatHistory(recipientId) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    // Show loading state
    chatBox.innerHTML = '<div class="d-flex justify-content-center my-4"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div></div>';

    try {
      const response = await fetch(`/chat/history/${recipientId}`);
      if (response.ok) {
        const messages = await response.json();
        chatBox.innerHTML = ''; // Clear spinner
        messages.forEach(msg => appendChatMessage(msg.sender, msg.message));
      } else {
        chatBox.innerHTML = '<div class="text-center text-muted small my-3">Start the conversation...</div>';
      }
    } catch (error) {
      chatBox.innerHTML = '<div class="text-center text-danger small my-3">Could not load history.</div>';
    }
  }

  // --- 3. Global Socket Event Listeners ---

  // Listen for incoming messages from anyone
  socket.on('chat message', (data) => {
    const chatBox = document.getElementById('chat-box'); // This is the same ID for both main page and popup
    if (!chatBox) return;

    const pathParts = window.location.pathname.split('/');
    let activeChatId = null;

    // Case 1: We are on the main chat page (/chat/:id)
    if (pathParts.length > 2 && pathParts[1] === 'chat') {
      activeChatId = pathParts[2];
    }
    // Case 2: The chat popup is open on another page (e.g., /items/:id)
    else if (chatContainer && chatContainer.classList.contains('is-open')) {
      activeChatId = chatContainer.dataset.recipientId;
    }

    // If the incoming message is from the person we are actively chatting with, display it.
    if (activeChatId && String(data.sender) === String(activeChatId)) {
      appendChatMessage(data.sender, data.message);
    } else {
      // Otherwise, show a notification dot on the main chat navigation link.
      const chatNavLink = document.getElementById('chat-nav-link');
      if (chatNavLink && !document.getElementById('chat-notification-badge')) {
        const badge = document.createElement('span');
        badge.id = 'chat-notification-badge';
        badge.className = 'notification-dot';
        chatNavLink.appendChild(badge);
      }
    }
  });

  // --- 4. Page-Specific Logic ---

  // On any /chat/* page, remove the notification badge
  if (window.location.pathname.startsWith('/chat')) {
    const badge = document.getElementById('chat-notification-badge');
    if (badge) badge.remove();
  }

  // Logic for the main chat page (/chat/:id)
  const chatForm = document.getElementById('chat-form');
  if (chatForm) {
    const messageInput = document.getElementById('message');
    const chatBox = document.getElementById('chat-box');

    // Scroll to the bottom of messages on load
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = messageInput.value.trim();
      const pathParts = window.location.pathname.split('/');
      const recipientId = pathParts.length > 2 && pathParts[1] === 'chat' ? pathParts[2] : null;

      if (!message || !recipientId) return;

      const recipientName = document.querySelector('#chat-with')?.textContent.replace('Chat with ', '') || 'User';

      // Use the shared send function
      await sendMessage(recipientId, recipientName, message);

      // Show the sent message locally
      appendChatMessage('You', message);
      messageInput.value = '';
    });
  }

  // --- 5. Chat Popup Logic (for initiating chats from other pages) ---
  const openChatBtn = document.getElementById('open-chat-btn');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatContainer = document.getElementById('chat-container');
  const chatOverlay = document.getElementById('chat-overlay');
  const popupChatForm = document.getElementById('popup-chat-form');

  // Open popup and prepare it with recipient data
  if (openChatBtn && chatContainer) {
    openChatBtn.addEventListener('click', () => {
      const recipientId = openChatBtn.dataset.recipientId;
      const recipientName = openChatBtn.dataset.recipientName;

      if (!recipientId || !recipientName) {
        console.error('Chat button is missing data-recipient-id or data-recipient-name attributes.');
        alert('Cannot initiate chat. Recipient information is missing.');
        return;
      }

      // Store recipient info on the popup container for the form to use
      chatContainer.dataset.recipientId = recipientId;
      chatContainer.dataset.recipientName = recipientName;

      // Update popup title
      const popupTitle = chatContainer.querySelector('.chat-popup-header h5');
      if (popupTitle) popupTitle.textContent = `Chat with ${recipientName}`;

      // Load previous messages
      loadChatHistory(recipientId);

      chatContainer.classList.add('is-open');
      document.body.classList.add('chat-open');
    });
  }

  // Handle sending the first message from the popup
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

    popupChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = popupMsgInput.value.trim();
      const { recipientId, recipientName } = chatContainer.dataset;

      if (!message || !recipientId) return;

      // Use the shared send function
      await sendMessage(recipientId, recipientName, message);

      // Show the sent message locally in the popup
      appendChatMessage('You', message);

      // Clear the input field and reset the counter
      popupMsgInput.value = '';
      const counter = popupMsgInput.parentNode.querySelector('.char-counter');
      if (counter) {
        counter.textContent = `0/${popupMsgInput.maxLength}`;
      }
    });
  }

  // Generic close handlers for the popup
  const closeChat = () => {
    if (chatContainer) {
      chatContainer.classList.remove('is-open');
      document.body.classList.remove('chat-open');
    }
  };
  if (closeChatBtn) closeChatBtn.addEventListener('click', closeChat);
  if (chatOverlay) chatOverlay.addEventListener('click', closeChat);
});
