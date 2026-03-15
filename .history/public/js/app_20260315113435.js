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

  const openChat = () => {
    if (chatContainer) {
      chatContainer.classList.add('is-open');
      document.body.classList.add('chat-open');
    }
  };

  const closeChat = () => {
    if (chatContainer) {
      chatContainer.classList.remove('is-open');
      document.body.classList.remove('chat-open');
    }
  };

  if (openChatBtn) openChatBtn.addEventListener('click', openChat);
  if (closeChatBtn) closeChatBtn.addEventListener('click', closeChat);
  if (chatOverlay) chatOverlay.addEventListener('click', closeChat);

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('chat') === 'open') openChat();

  // Socket.io Chat Logic
  const chatForm = document.getElementById('chat-form');
  const chatMessages = document.getElementById('chat-messages');

  if (typeof io !== 'undefined' && chatForm && chatMessages) {
    const socket = io();
    const itemId = window.location.pathname.split('/').pop();
    const username = chatForm.dataset.username;

    // Join the room for this specific item
    socket.emit('join', itemId);

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = chatForm.querySelector('input[name="message"]');
      const message = input.value.trim();

      if (message) {
        socket.emit('chat message', {
          room: itemId,
          user: username,
          text: message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        input.value = '';
      }
    });

    socket.on('chat message', (msg) => {
      const div = document.createElement('div');
      const isMe = msg.user === username;
      div.className = `d-flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'} mb-2`;
      div.innerHTML = `<div class="small text-muted">${msg.user}</div><div class="p-2 rounded ${isMe ? 'bg-primary text-white' : 'bg-white border'}" style="max-width: 80%;">${msg.text}</div><div class="small text-muted" style="font-size: 0.7rem;">${msg.timestamp}</div>`;
      chatMessages.appendChild(div);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }
});
