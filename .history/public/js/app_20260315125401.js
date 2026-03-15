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
  }

  const closeChat = () => {
    if (chatContainer) {
      chatContainer.classList.remove('is-open');
      document.body.classList.remove('chat-open');
    }
  };

  if (closeChatBtn) closeChatBtn.addEventListener('click', closeChat);
  if (chatOverlay) chatOverlay.addEventListener('click', closeChat);

  const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message');
    const chatBox = document.getElementById('chat-box');
    const userList = document.getElementById('user-list');
    const chatWith = document.getElementById('chat-with');

    if (typeof io !== 'undefined' && chatForm && chatBox) {
        const socket = io();
        // Check if we are in a specific chat room (URL path)
        const pathParts = window.location.pathname.split('/');
        let recipientId = pathParts.length > 2 && pathParts[1] === 'chat' ? pathParts[2] : null;

        // Get user ID from the server (you'll need to pass this from your backend)
        const userId = document.body.dataset.userId;
        const userName = document.body.dataset.userName || 'User';

        // Notify server that user is online
        socket.emit('user online', userId);

        // Scroll to bottom of chat on load
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

        // Get online users
        socket.on('online users', (users) => {
            if (!userList) return;
            // Optionally update online status indicators instead of clearing list
            // userList.innerHTML = ''; 
            users.forEach(user => {
                if (user.userId !== userId) {
                   // Logic to mark users as online in the existing list
                }
            });
        });

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = messageInput.value;
            if (message && recipientId) {
                const data = {
                    sender: userId,
                    senderName: userName,
                    recipient: recipientId,
                    message: message
                };
                
                // 1. Persist message via HTTP API
                try {
                    await fetch('/chat/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            recipientId: recipientId, 
                            recipientName: document.querySelector('#chat-with')?.textContent.replace('Chat with ', '') || 'User',
                            content: message 
                        })
                    });
                } catch (err) {
                    console.error('Failed to save message', err);
                }

                // 2. Emit socket event for real-time
                socket.emit('chat message', data);

                // 3. Show message locally
                appendMessage('You', message);
                messageInput.value = '';
            }
        });

        socket.on('chat message', (data) => {
            // Only append if we are chatting with this person
            if (String(data.sender) === String(recipientId)) {
                appendMessage(data.sender, data.message);
            }
        });

        socket.on('private message', (data) => {
            // Handle incoming private messages
            if (data.sender === recipientId) {
                appendMessage(data.senderName, data.message);
            } else {
                // Notify user of a new message from someone else
                alert(`New message from ${data.senderName}`);
            }
        });

        function appendMessage(sender, message) {
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
    }
});
