// Background script for handling notifications
// Note: For Manifest V3 in Firefox, service worker.

// Placeholder: Listen for messages, update unread
browser.runtime.onMessage.addListener((request, sender) => {
  if (request.type === 'getUnread') {
    // Query Supabase for unread count
    // Simulate for now
    const unread = Math.floor(Math.random() * 5);
    return Promise.resolve({ type: 'updateUnread', count: unread });
  }
});

// Periodically check for unread messages
setInterval(() => {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs[0]) {
      browser.tabs.sendMessage(tabs[0].id, { type: 'getUnread' });
    }
  });
}, 30000); // Every 30 seconds