(function () {
    const statusEl = () => document.getElementById('save-status');
    const formEl = () => document.getElementById('account-form');

    function estimateStrength(pw) {
        if (!pw) return 0;
        let score = 0;
        if (pw.length >= 8) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[a-z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        return Math.min(score, 4);
    }

    // Helper to load a script dynamically
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

    // Load Firebase compat SDKs only if window.firebase is not present
    async function ensureFirebaseCompatLoaded() {
        if (window.firebase) return;
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
        // Prefer global config; otherwise import from js/firebase-config.js
        let config = window.FB_CONFIG || window.firebaseConfig;
        if (!config) {
            try {
                const mod = await import('./js/firebase-config.js');
                if (mod?.firebaseConfig) {
                    config = mod.firebaseConfig;
                    window.FB_CONFIG = config; // cache globally
                }
            } catch (_) {
                // ignore import errors (e.g., non-module context)
            }
        }
        if (!config) {
            throw new Error('Firebase config not found. Set window.FB_CONFIG or ensure ./js/firebase-config.js exports firebaseConfig and attaches window.FB_CONFIG.');
        }

        // Initialize compat only if no app exists; avoids double init when modular is already initialized elsewhere
        if (fb.apps && fb.apps.length === 0) {
            fb.initializeApp(config);
        }
    }

    async function getSdk() {
        await ensureFirebaseAppInitialized();
        const fb = window.firebase;
        if (!fb?.auth || !fb?.firestore) {
            throw new Error('Firebase Auth/Firestore not available. Ensure compat SDKs are loaded.');
        }
        // Use v8 compat API for this page (browser-friendly)
        return {
            variant: 'v8',
            auth: fb.auth(),
            db: fb.firestore(),
            FieldValue: fb.firestore.FieldValue,
        };
    }

    // Populate inputs from the signed-in user and Firestore
    async function populateProfileFromUser(user, sdk) {
        const nameEl = document.getElementById('displayName');
        const emailEl = document.getElementById('email');
        const phoneEl = document.getElementById('phoneNumber');
        const statusEl = document.getElementById('save-status');

        if (!nameEl || !emailEl || !phoneEl) {
            console.warn('Account page inputs not found. Ensure IDs: displayName, email, phoneNumber.');
            if (statusEl) statusEl.textContent = 'Account form not found.';
            return;
        }

        nameEl.value = user.displayName || '';
        emailEl.value = user.email || '';

        try {
            const snap = await sdk.db.collection('users').doc(user.uid).get();
            const data = snap.exists ? snap.data() : {};
            phoneEl.value = data.phoneNumber || '';
            if (!user.displayName && data.displayName) {
                nameEl.value = data.displayName;
            }
        } catch (e) {
            console.warn('Could not load Firestore profile:', e);
            if (statusEl) statusEl.textContent = 'Loaded basic profile. Firestore details unavailable.';
        }
    }

    // Initialize page: wait for auth, then load profile and attach save handler
    // Attach handlers for both form submit and fallback button click
    function wireSaveHandlers() {
        const statusEl = document.getElementById('save-status');
    
        const form = document.getElementById('account-form');
        if (form) {
            // Allow partial saves by disabling HTML validation
            form.setAttribute('novalidate', '');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('[Account] Submit: Save Changes');
                if (statusEl) statusEl.textContent = 'Saving...';
                await saveChanges();
            });
        } else {
            console.warn('Account form not found. Ensure a <form id="account-form"> wraps the inputs.');
            if (statusEl) statusEl.textContent = 'Account form not found.';
        }
    
        // Fallback: handle explicit button click if the button is outside the form
        const btn = document.getElementById('save-button');
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('[Account] Click: Save Changes');
                if (statusEl) statusEl.textContent = 'Saving...';
                await saveChanges();
            });
        }
    }

    async function initAccountPage() {
        const statusEl = document.getElementById('save-status');
        try {
            const sdk = await getSdk();

            // Wait for auth readiness then populate
            sdk.auth.onAuthStateChanged(async (user) => {
                if (!user) {
                    if (statusEl) statusEl.textContent = 'Not signed in.';
                    return;
                }
                if (statusEl) statusEl.textContent = '';
                await populateProfileFromUser(user, sdk);
            });

            // Always wire handlers so Save works regardless of form/button structure
            wireSaveHandlers();

            // Optional: expose for debugging
            window._saveAccountChanges = saveChanges;
        } catch (e) {
            console.error('Initialization failed:', e);
            if (statusEl) statusEl.textContent = 'Initialization failed: ' + (e.message || e);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initAccountPage();
    });

    // Toast helper
    function showToast(message, timeout = 3000) {
        const el = document.getElementById('save-toast');
        if (!el) return;
        el.textContent = message;
        el.style.display = 'block';
        // Clear any previous timer
        if (window.__accountToastTimer) {
            clearTimeout(window.__accountToastTimer);
        }
        window.__accountToastTimer = setTimeout(() => {
            el.style.display = 'none';
        }, timeout);
    }

    async function saveChanges() {
        const statusEl = document.getElementById('save-status');
        try {
            const sdk = await getSdk();
            const user = sdk.auth.currentUser;
            if (!user) {
                if (statusEl) statusEl.textContent = 'Not signed in.';
                return;
            }

            // Read values (allow empty to mean "no change")
            const displayName = document.getElementById('displayName')?.value.trim() ?? '';
            const phoneNumber = document.getElementById('phoneNumber')?.value.trim() ?? '';
            const newEmail = document.getElementById('email')?.value.trim() ?? '';
            const currentPassword = document.getElementById('currentPassword')?.value ?? '';
            const newPassword = document.getElementById('newPassword')?.value ?? '';
            const confirmPassword = document.getElementById('confirmPassword')?.value ?? '';

            if (statusEl) statusEl.textContent = 'Saving...';

            // Build Firestore update only with provided non-empty fields
            const profileUpdates = {};
            if (displayName) profileUpdates.displayName = displayName;
            if (phoneNumber) profileUpdates.phoneNumber = phoneNumber;

            if (Object.keys(profileUpdates).length > 0) {
                await sdk.db.collection('users').doc(user.uid).set(profileUpdates, { merge: true });
            }

            // Update Auth profile only if displayName provided and changed
            if (displayName && displayName !== (user.displayName || '')) {
                await user.updateProfile({ displayName });
            }

            const needsEmailChange = !!newEmail && newEmail !== user.email;
            const needsPasswordChange = !!newPassword;

            // Only require current password when changing email or password
            async function reauthIfNeeded() {
                if (!(needsEmailChange || needsPasswordChange)) return;
                if (!currentPassword) throw new Error('Current password is required to change email or password.');
                await sdk.auth.signInWithEmailAndPassword(user.email, currentPassword);
            }

            await reauthIfNeeded();

            if (needsEmailChange) {
                await user.updateEmail(newEmail);
            }

            if (needsPasswordChange) {
                if (newPassword !== confirmPassword) {
                    if (statusEl) statusEl.textContent = 'New password and confirmation do not match.';
                    return;
                }
                await user.updatePassword(newPassword);
                await sdk.db.collection('users').doc(user.uid).set({
                    password_last_changed_at: sdk.FieldValue.serverTimestamp(),
                    password_strength_score: (function estimateStrength(pw) {
                        if (!pw) return 0;
                        let score = 0;
                        if (pw.length >= 8) score++;
                        if (/[A-Z]/.test(pw)) score++;
                        if (/[a-z]/.test(pw)) score++;
                        if (/[0-9]/.test(pw)) score++;
                        if (/[^A-Za-z0-9]/.test(pw)) score++;
                        return Math.min(score, 4);
                    })(newPassword),
                }, { merge: true });
            }

            if (statusEl) statusEl.textContent = 'Saved successfully.';
            showToast('Changes saved');

            // Emit profile changed event so other pages (or same page) can react,
            // and store a lightweight cache in localStorage.
            const profile = {
                uid: user.uid,
                displayName: displayName || user.displayName || '',
                email: (newEmail && newEmail !== user.email) ? newEmail : (user.email || ''),
                phoneNumber: phoneNumber || undefined,
            };
            try {
                localStorage.setItem('userProfileCache', JSON.stringify(profile));
            } catch (_) {}
            window.dispatchEvent(new CustomEvent('user-profile-changed', { detail: profile }));

            ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        } catch (e) {
            console.error('Save failed:', e);
            if (statusEl) statusEl.textContent = 'Save failed: ' + (e.message || e);
        }
    }
})();