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
    const cfg = window.firebaseConfig || window.FB_CONFIG;
    if (!cfg) {
      throw new Error('Firebase config not found.');
    }
    if (!window.firebase) {
      await ensureFirebaseCompatLoaded();
    }
    if (window.firebase && window.firebase.apps && window.firebase.apps.length === 0) {
      window.firebase.initializeApp(cfg);
    }
    return window.firebase;
  }

  function updateDomFromProfile(profile) {
    if (!profile) return;
    const name = profile.displayName || profile.fullName || '';
    const email = profile.email || '';
    const phone = profile.phoneNumber || '';
  
    // Update elements annotated with data-user-field
    document.querySelectorAll('[data-user-field]').forEach((el) => {
      const field = el.getAttribute('data-user-field');
      if (field && profile[field] !== undefined) {
        el.textContent = String(profile[field] ?? '');
      }
    });
  
    // Update a common header element if present
    const headerName = document.getElementById('current-user-name');
    if (headerName) headerName.textContent = name;
  }

  async function startSync() {
    try {
      const firebaseCompat = await ensureFirebaseAppInitialized();
      const auth = firebaseCompat.auth();
      const db = firebaseCompat.firestore();
  
      // Apply cached profile immediately
      try {
        const cached = localStorage.getItem('userProfileCache');
        if (cached) updateDomFromProfile(JSON.parse(cached));
      } catch (e) {
        console.warn('user-state: failed to read cached profile', e);
      }
  
      // React to cross-page saves
      window.addEventListener('user-profile-changed', (e) => {
        const profile = e.detail || {};
        try {
          localStorage.setItem('userProfileCache', JSON.stringify(profile));
        } catch {}
        updateDomFromProfile(profile);
      });
  
      // Auth listener
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          updateDomFromProfile({ displayName: '', email: '', phoneNumber: '' });
          return;
        }
        const uid = user.uid;
        // Prefer profiles, fallback to users
        try {
          const profDoc = await db.collection('profiles').doc(uid).get();
          let profile = profDoc.exists ? profDoc.data() : null;
          if (!profile) {
            const usersDoc = await db.collection('users').doc(uid).get();
            profile = usersDoc.exists ? usersDoc.data() : null;
          }
          // Merge with Auth details
          const merged = {
            uid,
            displayName: (profile && (profile.displayName || profile.fullName)) || user.displayName || '',
            fullName: (profile && profile.fullName) || (profile && profile.displayName) || user.displayName || '',
            email: user.email || (profile && profile.email) || '',
            phoneNumber: (profile && profile.phoneNumber) || ''
          };
          try {
            localStorage.setItem('userProfileCache', JSON.stringify(merged));
          } catch {}
          updateDomFromProfile(merged);
        } catch (err) {
          console.error('user-state: failed to load profile:', err);
        }
      });
  
    } catch (err) {
      console.error('user-state: Firebase init failed:', err);
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

  // Expose a global for dashboard.html onload
  window.checkUserState = function() {
    try {
      startSync();
    } catch (e) {
      console.error('checkUserState failed:', e);
    }
  };
  document.addEventListener('DOMContentLoaded', startSync);
})();