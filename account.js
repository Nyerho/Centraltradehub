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

    async function getSdk() {
        if (window.firebase?.auth && window.firebase?.firestore) {
            return {
                variant: 'v8',
                auth: window.firebase.auth(),
                db: window.firebase.firestore(),
                FieldValue: window.firebase.firestore.FieldValue
            };
        }
        const [{ getAuth, signInWithEmailAndPassword, updateEmail, updatePassword },
               { getFirestore, doc, getDoc, setDoc, serverTimestamp }] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js'),
        ]);
        return {
            variant: 'v9',
            auth: getAuth(),
            db: getFirestore(),
            signInWithEmailAndPassword,
            updateEmail,
            updatePassword,
            doc,
            getDoc,
            setDoc,
            serverTimestamp
        };
    }

    async function loadProfile() {
        const sdk = await getSdk();
        const user = sdk.auth.currentUser;
        if (!user) {
            statusEl().textContent = 'Not signed in.';
            return;
        }

        document.getElementById('displayName').value = user.displayName || '';
        document.getElementById('email').value = user.email || '';

        try {
            const uid = user.uid;
            if (sdk.variant === 'v8') {
                const snap = await sdk.db.collection('users').doc(uid).get();
                const data = snap.exists ? snap.data() : {};
                document.getElementById('phoneNumber').value = data.phoneNumber || '';
                if (!user.displayName && data.displayName) {
                    document.getElementById('displayName').value = data.displayName;
                }
            } else {
                const ref = sdk.doc(sdk.db, 'users', uid);
                const snap = await sdk.getDoc(ref);
                const data = snap.exists() ? snap.data() : {};
                document.getElementById('phoneNumber').value = data.phoneNumber || '';
                if (!user.displayName && data.displayName) {
                    document.getElementById('displayName').value = data.displayName;
                }
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
            statusEl().textContent = 'Not signed in.';
            return;
        }

        const displayName = document.getElementById('displayName').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        const newEmail = document.getElementById('email').value.trim();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        statusEl().textContent = 'Saving...';

        try {
            if (sdk.variant === 'v8') {
                await sdk.db.collection('users').doc(user.uid).set({
                    displayName,
                    phoneNumber
                }, { merge: true });
                await user.updateProfile({ displayName });
            } else {
                const { doc, setDoc } = sdk;
                await setDoc(doc(sdk.db, 'users', user.uid), {
                    displayName,
                    phoneNumber
                }, { merge: true });
                await user.updateProfile?.({ displayName });
            }
        } catch (e) {
            console.error('Profile update failed:', e);
            statusEl().textContent = 'Profile update failed: ' + (e.message || e);
            return;
        }

        const needsEmailChange = newEmail && newEmail !== user.email;
        const needsPasswordChange = newPassword && newPassword.length > 0;

        async function reauthIfNeeded() {
            if (!(needsEmailChange || needsPasswordChange)) return;
            if (!currentPassword) throw new Error('Current password is required to change email or password.');
            const currentEmail = user.email;
            if (sdk.variant === 'v8') {
                await sdk.auth.signInWithEmailAndPassword(currentEmail, currentPassword);
            } else {
                await sdk.signInWithEmailAndPassword(sdk.auth, currentEmail, currentPassword);
            }
        }

        try {
            await reauthIfNeeded();
        } catch (e) {
            console.error('Reauthentication failed:', e);
            statusEl().textContent = 'Reauthentication failed: ' + (e.message || e);
            return;
        }

        if (needsEmailChange) {
            try {
                if (sdk.variant === 'v8') {
                    await user.updateEmail(newEmail);
                } else {
                    await sdk.updateEmail(user, newEmail);
                }
            } catch (e) {
                console.error('Email update failed:', e);
                statusEl().textContent = 'Email update failed: ' + (e.message || e);
                return;
            }
        }

        if (needsPasswordChange) {
            if (newPassword !== confirmPassword) {
                statusEl().textContent = 'New password and confirmation do not match.';
                return;
            }
            try {
                if (sdk.variant === 'v8') {
                    await user.updatePassword(newPassword);
                    await sdk.db.collection('users').doc(user.uid).set({
                        password_last_changed_at: sdk.FieldValue.serverTimestamp(),
                        password_strength_score: estimateStrength(newPassword)
                    }, { merge: true });
                } else {
                    await sdk.updatePassword(user, newPassword);
                    const { doc, setDoc, serverTimestamp } = sdk;
                    await setDoc(doc(sdk.db, 'users', user.uid), {
                        password_last_changed_at: serverTimestamp(),
                        password_strength_score: estimateStrength(newPassword)
                    }, { merge: true });
                }
            } catch (e) {
                console.error('Password update failed:', e);
                statusEl().textContent = 'Password update failed: ' + (e.message || e);
                return;
            }
        }

        statusEl().textContent = 'Saved successfully.';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadProfile();
        formEl()?.addEventListener('submit', saveChanges);
    });
})();