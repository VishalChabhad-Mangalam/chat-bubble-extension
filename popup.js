document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('status');
  const logoutBtn = document.getElementById('logout');

  // Check auth status
  const result = await browser.storage.sync.get(['userId']);
  if (result.userId) {
    status.textContent = 'Logged in';
    logoutBtn.style.display = 'block';
  } else {
    status.textContent = 'Logged out';
    logoutBtn.style.display = 'none';
  }

  logoutBtn.addEventListener('click', async () => {
    // Clear storage (Supabase auth clears on session end, but this ensures UI sync)
    await browser.storage.sync.remove('userId');
    status.textContent = 'Logged out';
    logoutBtn.style.display = 'none';
    // Notify content script to reload (optional)
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.reload(tabs[0].id);
      }
    });
    window.close();
  });
});