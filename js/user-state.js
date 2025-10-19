(function () {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load script: ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureFirebaseCompatLoaded() {
    if (window.firebase) return;
    // Use the same compat version you prefer elsewhere (10.7.0 shown here)
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js');
    if (!window.firebase) {
      throw new Error('Firebase compat SDK failed to load.');
    }
  }

  async function ensureFirebaseAppInitialized() {
    await ensureFirebaseCompatLoaded();
    const fb = window.firebase;
    let config = window.FB_CONFIG || window.firebaseConfig;
    if (!config) {
      try {
        const mod = await import('./firebase-config.js');
        if (mod?.firebaseConfig) {
          config = mod.firebaseConfig;
          window.FB_CONFIG = config;
        }
      } catch (_) {}
    }
    if (!config) throw new Error('Firebase config not found.');
    if (fb.apps && fb.apps.length === 0) {
      fb.initializeApp(config);
    }
  }

  function mergeProfile(user, data) {
    const displayName = (data?.displayName) || user.displayName || '';
    const email = user.email || '';
    const phoneNumber = (data?.phoneNumber) || '';
    return {
      uid: user.uid,
      displayName,
      email,
      phoneNumber
    };
  }

  function updateDomFromProfile(profile) {
    if (!profile) return;
    const map = {
      displayName: profile.displayName || '',
      email: profile.email || '',
      phoneNumber: profile.phoneNumber || ''
    };
    document.querySelectorAll('[data-user-field]').forEach(el => {
      const key = el.getAttribute('data-user-field');
      if (key && key in map) {
        el.textContent = map[key];
      }
    });
  }

  async function startSync() {
    try {
      await ensureFirebaseAppInitialized();
    } catch (e) {
      console.warn('user-state: Firebase init failed:', e);
      return;
    }
    const fb = window.firebase;
    const auth = fb.auth();
    const db = fb.firestore();

    // Render cached values immediately if available
    try {
      const cached = JSON.parse(localStorage.getItem('userProfileCache') || 'null');
      if (cached) updateDomFromProfile(cached);
    } catch (_) {}

    let unsubscribe = null;

    auth.onAuthStateChanged(user => {
      if (unsubscribe) {
        try { unsubscribe(); } catch (_) {}
        unsubscribe = null;
      }

      if (!user) {
        window.dispatchEvent(new CustomEvent('user-profile-changed', { detail: null }));
        try { localStorage.removeItem('userProfileCache'); } catch (_) {}
        updateDomFromProfile({ displayName: '', email: '', phoneNumber: '' });
        return;
      }

      // Listen to Firestore user doc in real time
      const docRef = db.collection('users').doc(user.uid);
      unsubscribe = docRef.onSnapshot(snap => {
        const data = snap.exists ? snap.data() : {};
        const profile = mergeProfile(user, data);
        try {
          localStorage.setItem('userProfileCache', JSON.stringify(profile));
        } catch (_) {}
        window.dispatchEvent(new CustomEvent('user-profile-changed', { detail: profile }));
        updateDomFromProfile(profile);
      }, err => {
        console.warn('user-state: snapshot error:', err);
        const profile = mergeProfile(user, {});
        updateDomFromProfile(profile);
      });
    });

    window.addEventListener('beforeunload', () => {
      if (unsubscribe) {
        try { unsubscribe(); } catch (_) {}
      }
    });
  }

  document.addEventListener('DOMContentLoaded', startSync);
})();