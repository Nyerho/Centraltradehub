// Top-level Firebase references from global 'sdk'
// ... existing code ...
const sdk = window.sdk;
const auth = sdk ? sdk.auth() : null;
const db = sdk ? sdk.firestore() : null;
// ... existing code ...

function saveChanges(event) {
    // ... existing code ...
    try {
        if (!sdk || !auth || !db) {
            throw new Error('Firebase SDK not loaded');
        }

        const user = auth.currentUser;
        if (!user) {
            throw new Error('No authenticated user');
        }

        const displayNameInput = document.getElementById('displayName');
        const phoneInput = document.getElementById('phoneNumber');
        const displayName = displayNameInput ? displayNameInput.value.trim() : (user.displayName || '');
        const phoneNumber = phoneInput ? phoneInput.value.trim() : '';

        // Use sdk.updateProfile so it works with the module wrapper
        sdk.updateProfile({ displayName })
            .then(() => {
                const uid = user.uid;
                const payload = {
                    uid,
                    displayName,
                    fullName: displayName,
                    email: user.email || '',
                    phoneNumber: phoneNumber || '',
                    updatedAt: new Date()
                };

                // Compat-style calls supported by the wrapper
                return Promise.all([
                    db.collection('profiles').doc(uid).set(payload, { merge: true }),
                    db.collection('users').doc(uid).set(payload, { merge: true })
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
                try {
                    localStorage.setItem('userProfileCache', JSON.stringify(updatedProfile));
                } catch (e) {}
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
// ... existing code ...