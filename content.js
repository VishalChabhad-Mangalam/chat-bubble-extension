(function() {
  // Load Supabase client (v2 SDK)
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  document.head.appendChild(script);

  // Wait for Supabase to load
  script.onload = async () => {
    // Import the client after SDK loads
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    
    // Initialize Supabase - REPLACE WITH YOUR CREDENTIALS
    const supabaseUrl = 'https://xmilljfczxpitehlunoi.supabase.co'; 
    const supabaseKey = 'sb_publishable_WLyUbv1cguY99L9nZhcmfg_zrPYfEb8'; 
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Supabase initialized:', supabaseUrl); // Debug log

    // Load position from storage
    browser.storage.sync.get(['bubblePosition']).then((result) => {
      const pos = result.bubblePosition || { x: window.innerWidth - 80, y: window.innerHeight - 80 };
      createBubble(pos.x, pos.y);
    });

    function createBubble(x, y) {
      const existing = document.getElementById('chat-bubble');
      if (existing) existing.remove();

      const bubble = document.createElement('div');
      bubble.id = 'chat-bubble';
      bubble.className = 'chat-bubble';
      bubble.innerHTML = '💬';
      bubble.style.left = x + 'px';
      bubble.style.top = y + 'px';
      bubble.style.position = 'absolute';

      const badge = document.createElement('div');
      badge.id = 'unread-badge';
      badge.className = 'unread-badge';
      badge.style.display = 'none';
      bubble.appendChild(badge);

      document.body.appendChild(bubble);

      // Dragging logic
      let isDragging = false;
      let currentX, currentY, initialX, initialY;

      bubble.addEventListener('mousedown', (e) => {
        isDragging = true;
        initialX = e.clientX - bubble.offsetLeft;
        initialY = e.clientY - bubble.offsetTop;
        bubble.classList.add('dragging');
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
      });

      function drag(e) {
        if (isDragging) {
          e.preventDefault();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
          bubble.style.left = currentX + 'px';
          bubble.style.top = currentY + 'px';
        }
      }

      function stopDrag() {
        isDragging = false;
        bubble.classList.remove('dragging');
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
        const fixedX = currentX + window.scrollX;
        const fixedY = currentY + window.scrollY;
        browser.storage.sync.set({ bubblePosition: { x: fixedX, y: fixedY } });
      }

      bubble.addEventListener('click', () => {
        openChatPopup();
      });

      // Real-time unread count subscription
      const channel = supabase.channel('messages');
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
          console.log('Realtime message insert:', payload); // Debug log
          updateUnreadCount();
        })
        .subscribe((status) => {
          console.log('Subscription status:', status); // Debug log
        });

      updateUnreadCount();
    }

    async function updateUnreadCount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('recipient_id', user.id)
        .eq('read', false);
      if (error) {
        console.error('Unread count error:', error);
        return;
      }
      const count = data?.length || 0;
      const badge = document.getElementById('unread-badge');
      if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      }
      browser.runtime.sendMessage({ type: 'updateUnread', count });
    }

    function openChatPopup() {
      let popup = document.getElementById('chat-popup');
      if (!popup) {
        popup = document.createElement('div');
        popup.id = 'chat-popup';
        popup.className = 'chat-popup';
        popup.innerHTML = `
          <div class="chat-header">
            <span>Chat</span>
            <span class="chat-close" onclick="closeChatPopup()">&times;</span>
          </div>
          <div id="chat-content" style="flex:1; display:flex; flex-direction:column;">
          </div>
          <div class="chat-input">
            <input type="text" id="message-input" placeholder="Type message..." disabled>
            <button id="send-button" disabled>Send</button>
          </div>
        `;
        document.body.appendChild(popup);
      }
      popup.classList.add('open');
      loadChatContent();
    }

    window.closeChatPopup = function() {
      const popup = document.getElementById('chat-popup');
      if (popup) popup.classList.remove('open');
    };

    async function loadChatContent() {
      const content = document.getElementById('chat-content');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        content.innerHTML = `
          <div class="login-form">
            <h3>Login</h3>
            <input type="email" id="email" placeholder="Email">
            <input type="password" id="password" placeholder="Password">
            <button onclick="login()">Login</button>
            <button onclick="register()">Register</button>
          </div>
        `;
        window.login = login;
        window.register = register;
      } else {
        content.innerHTML = '<div class="chat-messages" id="messages"></div>';
        loadMessages(user.id);
        document.getElementById('message-input').disabled = false;
        document.getElementById('send-button').disabled = false;
      }
    }

    window.login = async function() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert('Login failed: ' + error.message);
        return;
      }
      browser.storage.sync.set({ userId: user.id });
      loadChatContent();
      updateUnreadCount();
    };

    window.register = async function() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert('Registration failed: ' + error.message);
        return;
      }
      alert('Registration successful! Please check your email for confirmation.');
      // Auto-login after confirmation (in production, handle email verification)
      setTimeout(() => window.login(), 2000);
    };

    async function loadMessages(userId) {
      const messagesDiv = document.getElementById('messages');
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('timestamp', { ascending: true });
      if (error) {
        console.error('Load messages error:', error);
        messagesDiv.innerHTML = '<div>Error loading messages</div>';
        return;
      }
      if (data) {
        messagesDiv.innerHTML = data.map(msg => {
          const sender = msg.sender_id === userId ? 'You' : 'Other';
          return `<div><strong>${sender}:</strong> ${msg.text}</div>`;
        }).join('');
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }

      // Real-time message updates for this user
      const channel = supabase.channel('user-messages');
      channel
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `sender_id=eq.${userId},recipient_id=eq.${userId}` 
        }, (payload) => {
          const msg = payload.new;
          if (msg.sender_id === userId || msg.recipient_id === userId) {
            const sender = msg.sender_id === userId ? 'You' : 'Other';
            const msgElement = document.createElement('div');
            msgElement.innerHTML = `<strong>${sender}:</strong> ${msg.text}`;
            messagesDiv.appendChild(msgElement);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            if (msg.recipient_id === userId && !msg.read) {
              // Mark as read (update in DB)
              supabase.from('messages').update({ read: true }).eq('id', msg.id);
              updateUnreadCount();
            }
          }
        })
        .subscribe();
    }

    // Send message handler
    document.addEventListener('click', async (e) => {
      if (e.target.id === 'send-button') {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        if (text) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // For demo: self-message. For multi-user, add recipient selection
            const { error } = await supabase.from('messages').insert({
              sender_id: user.id,
              recipient_id: user.id, // Change this for multi-user
              text,
              timestamp: new Date().toISOString(),
              read: false
            });
            if (error) console.error('Send error:', error);
            input.value = '';
          }
        }
      }
    });

    // Persist auth state
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id); // Debug log
      if (session) {
        browser.storage.sync.set({ userId: session.user.id });
        if (document.getElementById('chat-popup')) loadChatContent();
      } else {
        browser.storage.sync.remove('userId');
      }
    });
  };

  // Error handling for SDK load
  script.onerror = () => console.error('Failed to load Supabase SDK');
})();