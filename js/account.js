// Top-level Firebase references from global 'sdk'
const sdk = window.sdk || null;              // from firebase-config.js module
const compat = window.firebase || null;      // compat namespace (if loaded via CDN)
const auth = (sdk && sdk.auth) ? sdk.auth() : (compat && compat.auth ? compat.auth() : null);
let db = (sdk && sdk.firestore) ? sdk.firestore() : (compat && compat.firestore ? compat.firestore() : null);

function saveChanges(event) {
    // ... existing code ...
    try {
        // Re-derive in case SDK finished initializing after script load
        const sdkNow = window.sdk || null;
        const compatNow = window.firebase || null;
        const authNow = (sdkNow && sdkNow.auth) ? sdkNow.auth() : (compatNow && compatNow.auth ? compatNow.auth() : null);
        const dbNow = (sdkNow && sdkNow.firestore) ? sdkNow.firestore() : (compatNow && compatNow.firestore ? compatNow.firestore() : null);

        if (!authNow) {
            throw new Error('Firebase Auth not initialized');
        }
        if (!dbNow || !dbNow.collection) {
            throw new Error('Firestore DB is not initialized');
        }

        const user = authNow.currentUser;
        if (!user) {
            throw new Error('No authenticated user');
        }

        const displayNameInput = document.getElementById('displayName');
        const phoneInput = document.getElementById('phoneNumber');
        const displayName = displayNameInput ? displayNameInput.value.trim() : (user.displayName || '');
        const phoneNumber = phoneInput ? phoneInput.value.trim() : '';

        // Use wrapper if available; otherwise fallback to native updateProfile on the user
        const updateAuthProfile = (name) => {
            if (sdkNow && typeof sdkNow.updateProfile === 'function') {
                return sdkNow.updateProfile({ displayName: name });
            }
            if (user && typeof user.updateProfile === 'function') {
                return user.updateProfile({ displayName: name });
            }
            return Promise.reject(new Error('updateProfile not available'));
        };

        updateAuthProfile(displayName)
            .then(() => {
                const uid = user.uid;
                const payload = {
                    uid,
                    displayName,
                    fullName: displayName,  // support pages that read fullName
                    email: user.email || '',
                    phoneNumber: phoneNumber || '',
                    updatedAt: new Date()
                };

                // Write to both collections if your app expects them
                return Promise.all([
                    dbNow.collection('profiles').doc(uid).set(payload, { merge: true }),
                    dbNow.collection('users').doc(uid).set(payload, { merge: true })
                ]);
            })
            .then(() => {
                const updatedProfile = {
                    uid: user.uid,
                    displayName,
                    fullName: displayName,
                    email: user.email || '',
                    phoneNumber: phoneNumber || ''
                };
                try { localStorage.setItem('userProfileCache', JSON.stringify(updatedProfile)); } catch {}
                window.dispatchEvent(new CustomEvent('user-profile-changed', { detail: updatedProfile }));
                console.log('Changes saved successfully.');
                // If you have a toast helper:
                // showToast('Changes saved', 'success');
            })
            .catch((err) => {
                console.error('Save failed:', err);
                // showToast(`Save failed: ${err.message}`, 'error');
            });

    } catch (err) {
        console.error('Save failed:', err);
        // showToast(`Save failed: ${err.message}`, 'error');
    }
    // ... existing code ...
}