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

  // Chat Popup Logic
  const openChatBtn = document.getElementById('open-chat-btn');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatContainer = document.getElementById('chat-container');
  const chatOverlay = document.getElementById('chat-overlay');
  // --- Chat & Notification Logic ---
  const userId = document.body.dataset.userId;
  const userName = document.body.dataset.userName || 'User';

  if (openChatBtn && chatContainer) {
    openChatBtn.addEventListener('click', () => {
      chatContainer.classList.add('is-open');
      document.body.classList.add('chat-open');
    });

    const popupMsgInput = chatContainer.querySelector('[name="message"]');
    if (popupMsgInput) {
      const maxLength = 300;
      popupMsgInput.maxLength = maxLength;

      const counter = document.createElement('div');
      counter.className = 'text-end text-muted mt-1 small';
      counter.textContent = `0/${maxLength}`;
      popupMsgInput.parentNode.appendChild(counter);

      popupMsgInput.addEventListener('input', () => {
        counter.textContent = `${popupMsgInput.value.length}/${maxLength}`;
      });
    }
  // Exit if Socket.IO is not loaded or user is not logged in
  if (typeof io === 'undefined' || !userId) {
    return;
  }

  const closeChat = () => {
    if (chatContainer) {
      chatContainer.classList.remove('is-open');
      document.body.classList.remove('chat-open');
    }
  };
  // --- 1. Establish a single, reusable socket connection ---
  const socket = io();
  socket.emit('user online', userId);

  if (closeChatBtn) closeChatBtn.addEventListener('click', closeChat);
  if (chatOverlay) chatOverlay.addEventListener('click', closeChat);
  // --- 2. Helper Functions ---

  // --- Main Chat & Notification Logic ---
  const userId = document.body.dataset.userId;

  // Helper function to append messages, defined once.
  /**
   * Appends a chat message to the chat box UI.
   * Differentiates between sent ('You') and received (sender's ID) messages.
   */
  function appendChatMessage(sender, message) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const messageElement = document.createElement('div');
    const currentUserId = document.body.dataset.userId;
    const isMe = sender === 'You' || String(sender) === String(currentUserId);
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

  if (typeof io !== 'undefined' && userId) {
    const socket = io();
    socket.emit('user online', userId);
  /**
   * Persists a message to the server and emits it via socket.
   */
  async function sendMessage(recipientId, recipientName, message) {
    const data = { sender: userId, senderName: userName, recipient: recipientId, message };

    // 1. Universal message listener
    socket.on('chat message', (data) => {
      const chatBox = document.getElementById('chat-box');
      const pathParts = window.location.pathname.split('/');
      const activeChatId = chatBox && pathParts.length > 2 && pathParts[1] === 'chat' ? pathParts[2] : null;
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

      // If we are in the active chat, append the message
      if (activeChatId && String(data.sender) === activeChatId) {
        appendChatMessage(data.senderName, data.message);
      } else {
        // Otherwise, show notification badge
        const chatNavLink = document.getElementById('chat-nav-link');
        if (chatNavLink && !document.getElementById('chat-notification-badge')) {
          const badge = document.createElement('span');
          badge.id = 'chat-notification-badge';
          badge.className = 'notification-dot';
          chatNavLink.appendChild(badge);
        }
    // b. Emit for real-time delivery
    socket.emit('chat message', data);
  }

  // --- 3. Global Socket Event Listeners ---

  // Listen for incoming messages from anyone
  socket.on('chat message', (data) => {
    const chatBox = document.getElementById('chat-box');
    const pathParts = window.location.pathname.split('/');
    const activeChatId = chatBox && pathParts.length > 2 && pathParts[1] === 'chat' ? pathParts[2] : null;

    // If we are on the correct chat page, display the message
    if (activeChatId && String(data.sender) === activeChatId) {
      appendChatMessage(data.sender, data.message);
    } else {
      // Otherwise, show a notification dot on the main chat navigation link
      const chatNavLink = document.getElementById('chat-nav-link');
      if (chatNavLink && !document.getElementById('chat-notification-badge')) {
        const badge = document.createElement('span');
        badge.id = 'chat-notification-badge';
        badge.className = 'notification-dot';
        chatNavLink.appendChild(badge);
      }
    });
    }
  });

    // 2. Clear badge on navigating to chat page
    if (window.location.pathname.startsWith('/chat')) {
      const badge = document.getElementById('chat-notification-badge');
      if (badge) badge.remove();
    }
  // --- 4. Page-Specific Logic ---

  // On any /chat/* page, remove the notification badge
  if (window.location.pathname.startsWith('/chat')) {
    const badge = document.getElementById('chat-notification-badge');
    if (badge) badge.remove();
  }

  // 3. Chat page specific logic (form submission)
  // Logic for the main chat page (/chat/:id)
  const chatForm = document.getElementById('chat-form');
  if (chatForm) {
    const messageInput = document.getElementById('message');
    const chatBox = document.getElementById('chat-box');

    // Scroll to bottom
    // Scroll to the bottom of messages on load
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = messageInput.value.trim();
      const pathParts = window.location.pathname.split('/');
      const recipientId = pathParts.length > 2 && pathParts[1] === 'chat' ? pathParts[2] : null;

      if (!message || !recipientId) return;

      const userName = document.body.dataset.userName || 'User';
      const data = { sender: userId, senderName: userName, recipient: recipientId, message };
      const recipientName = document.querySelector('#chat-with')?.textContent.replace('Chat with ', '') || 'User';

      // Persist message
      try {
        await fetch('/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            recipientId, 
            recipientName: document.querySelector('#chat-with')?.textContent.replace('Chat with ', '') || 'User',
            content: message 
          })
        });
      } catch (err) {
        console.error('Failed to save message', err);
      }
      // Use the shared send function
      await sendMessage(recipientId, recipientName, message);

      // Emit for real-time
      const socket = io();
      socket.emit('chat message', data);

      // Show locally
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

      // After sending, redirect to the full chat page for this conversation
      window.location.href = `/chat/${recipientId}`;
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
