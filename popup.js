document.getElementById('close-btn').addEventListener('click', () => window.close());

document.getElementById('go-btn').addEventListener('click', async () => {
  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url.includes('instagram.com')) {
    alert('Please open Instagram first!');
    return;
  }

  // Inject a script to find the username
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Look for the profile link in the side navigation
      // It usually has an href like `/{username}/` and is inside a nav element
      const profileLink = document.querySelector('nav a[href^="/"][href$="/"]');
      if (profileLink) {
        const username = profileLink.getAttribute('href').replaceAll('/', '');
        if (username && username !== 'explore' && username !== 'reels' && username !== 'direct') {
          window.location.href = `https://www.instagram.com/${username}/saved/all-posts/`;
          return;
        }
      }
      
      // Fallback: look at any link pointing to a profile
      const anyProfileLink = Array.from(document.querySelectorAll('a')).find(a => {
        const href = a.getAttribute('href');
        return href && href.startsWith('/') && href.endsWith('/') && href.split('/').length === 3;
      });

      if (anyProfileLink) {
        const username = anyProfileLink.getAttribute('href').replaceAll('/', '');
        window.location.href = `https://www.instagram.com/${username}/saved/all-posts/`;
      } else {
        // Fallback: default to opening https://www.instagram.com/ and prompt the user
        alert('Could not securely determine your username. Redirecting to Instagram home. Please click your profile manually.');
        window.location.href = 'https://www.instagram.com/';
      }
    }
  });
});
