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

    // Load Firebase compat SDKs if not present
    async function ensureFirebaseCompatLoaded() {
        if (window.firebase) return;
        // Load compat SDKs from CDN in order
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js');
        if (!window.firebase) {
            throw new Error('Firebase compat SDK failed to load.');
        }
    }

    async function ensureFirebaseAppInitialized() {
        await ensureFirebaseCompatLoaded();

        const fb = window.firebase;
        // Try to obtain config from global FB_CONFIG or firebase-config.js
        let config = window.FB_CONFIG || window.firebaseConfig;
        if (!config) {
            try {
                const mod = await import('./firebase-config.js');
                if (mod?.firebaseConfig) {
                    config = mod.firebaseConfig;
                    window.FB_CONFIG = config; // cache globally
                }
            } catch (_) {
                // ignore import error; we might have FB_CONFIG set elsewhere
            }
        }
        if (!config) {
            throw new Error('Firebase config not found. Set window.FB_CONFIG or provide ./firebase-config.js exporting firebaseConfig.');
        }

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
        // Use v8 compat API to avoid modular getApp/getAuth calls
        return {
            variant: 'v8',
            auth: fb.auth(),
            db: fb.firestore(),
            FieldValue: fb.firestore.FieldValue,
        };
    }

    async function loadProfile() {
        const sdk = await getSdk();
        const user = sdk.auth.currentUser;
        if (!user) {
            document.getElementById('save-status').textContent = 'Not signed in.';
            return;
        }
        document.getElementById('displayName').value = user.displayName || '';
        document.getElementById('email').value = user.email || '';

        try {
            const snap = await sdk.db.collection('users').doc(user.uid).get();
            const data = snap.exists ? snap.data() : {};
            document.getElementById('phoneNumber').value = data.phoneNumber || '';
            if (!user.displayName && data.displayName) {
                document.getElementById('displayName').value = data.displayName;
            }
        } catch (e) {
            console.warn('Could not load Firestore profile:', e);
        }
    }

    async function saveChanges(e) {
        e.preventDefault();
        const sdk = await getSdk();
        const user = sdk.auth.currentUser;
        if (!user) {
            document.getElementById('save-status').textContent = 'Not signed in.';
            return;
        }

        const displayName = document.getElementById('displayName').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        const newEmail = document.getElementById('email').value.trim();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        document.getElementById('save-status').textContent = 'Saving...';

        try {
            await sdk.db.collection('users').doc(user.uid).set({
                displayName,
                phoneNumber
            }, { merge: true });
            await user.updateProfile({ displayName });
        } catch (e) {
            console.error('Profile update failed:', e);
            document.getElementById('save-status').textContent = 'Profile update failed: ' + (e.message || e);
            return;
        }

        const needsEmailChange = newEmail && newEmail !== user.email;
        const needsPasswordChange = newPassword && newPassword.length > 0;

        async function reauthIfNeeded() {
            if (!(needsEmailChange || needsPasswordChange)) return;
            if (!currentPassword) throw new Error('Current password is required to change email or password.');
            const currentEmail = user.email;
            await sdk.auth.signInWithEmailAndPassword(currentEmail, currentPassword);
        }

        try {
            await reauthIfNeeded();
        } catch (e) {
            console.error('Reauthentication failed:', e);
            document.getElementById('save-status').textContent = 'Reauthentication failed: ' + (e.message || e);
            return;
        }

        if (needsEmailChange) {
            try {
                await user.updateEmail(newEmail);
            } catch (e) {
                console.error('Email update failed:', e);
                document.getElementById('save-status').textContent = 'Email update failed: ' + (e.message || e);
                return;
            }
        }

        if (needsPasswordChange) {
            if (newPassword !== confirmPassword) {
                document.getElementById('save-status').textContent = 'New password and confirmation do not match.';
                return;
            }
            try {
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
                    })(newPassword)
                }, { merge: true });
            } catch (e) {
                console.error('Password update failed:', e);
                document.getElementById('save-status').textContent = 'Password update failed: ' + (e.message || e);
                return;
            }
        }

        document.getElementById('save-status').textContent = 'Saved successfully.';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadProfile();
        document.getElementById('account-form')?.addEventListener('submit', saveChanges);
    });
})();