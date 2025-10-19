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
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js');
    if (!window.firebase) throw new Error('Firebase compat SDK failed to load.');
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
    // Prefer Firestore name; support both displayName and fullName; fallback to Auth
    const nameFromDb = data?.displayName || data?.fullName || '';
    return {
      uid: user.uid,
      displayName: nameFromDb || user.displayName || '',
      email: user.email || data?.email || '',
      phoneNumber: data?.phoneNumber || ''
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
      if (key && key in map) el.textContent = map[key];
    });
    const nameEl = document.getElementById('current-user-name');
    if (nameEl) nameEl.textContent = map.displayName || 'User';
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

    // Render cached values immediately
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

      // Prefer profiles/{uid}, fallback to users/{uid}
      const profilesRef = db.collection('profiles').doc(user.uid);
      const usersRef = db.collection('users').doc(user.uid);

      unsubscribe = profilesRef.onSnapshot(snap => {
        let data = snap.exists ? snap.data() : null;
        const handleUsersFallback = () => {
          return usersRef.onSnapshot(usersSnap => {
            const usersData = usersSnap.exists ? usersSnap.data() : {};
            const profile = mergeProfile(user, usersData || {});
            try { localStorage.setItem('userProfileCache', JSON.stringify(profile)); } catch (_) {}
            window.dispatchEvent(new CustomEvent('user-profile-changed', { detail: profile }));
            updateDomFromProfile(profile);
          }, err => {
            console.warn('user-state: users snapshot error:', err);
            const profile = mergeProfile(user, {});
            updateDomFromProfile(profile);
          });
        };

        // If profiles doc not present, fallback to users collection
        if (!data) {
          // switch subscription to users
          if (unsubscribe) {
            try { unsubscribe(); } catch (_) {}
            unsubscribe = null;
          }
          unsubscribe = handleUsersFallback();
          return;
        }

        const profile = mergeProfile(user, data);
        try { localStorage.setItem('userProfileCache', JSON.stringify(profile)); } catch (_) {}
        window.dispatchEvent(new CustomEvent('user-profile-changed', { detail: profile }));
        updateDomFromProfile(profile);
      }, err => {
        console.warn('user-state: profiles snapshot error:', err);
        // On error, at least show Auth values
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