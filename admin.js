// Top-level config (near your existing config/constants)
const EXTERNAL_DELETE_ENABLED = false; // Set to true only when your backend is live and reachable
const PROD_API_BASE = 'https://www.centraltradekeplr.com/api';
const LOCAL_API_BASE = 'http://localhost:3001/api';

// Explicitly disable external API deletion for half-delete mode
const USE_EXTERNAL_DELETE = false;

async function deleteFirestoreUser(uid) {
    // Assumes modular Firestore v9 style with exported 'db', 'doc', 'deleteDoc'
    // Adjust collection name if your schema differs.
    await deleteDoc(doc(db, 'users', uid));

    // Optional: write a tombstone/audit record (ignore failures)
    try {
        await setDoc(doc(db, 'deleted_users', uid), {
            uid,
            deletedAt: serverTimestamp()
        });
    } catch (auditErr) {
        console.warn('Could not write delete audit record:', auditErr);
    }
}

async function tryDeleteFromApi(uid) {
    // Attempt primary (prod) delete
    const primaryUrl = `${PROD_API_BASE}/users/${encodeURIComponent(uid)}`;
    console.log('DELETE URL:', primaryUrl);
    try {
        const res = await fetch(primaryUrl, { method: 'DELETE' });
        console.log('Delete response status:', res.status);

        if (res.ok) {
            return { ok: true, source: 'prod', status: res.status };
        }
        if (res.status === 404) {
            console.warn('Primary delete endpoint not found. Retrying against local admin server...');
        } else {
            console.warn('Primary delete failed with status:', res.status);
        }
    } catch (e) {
        console.error('Primary delete failed:', e);
    }

    // Fallback to local admin server
    const localUrl = `${LOCAL_API_BASE}/users/${encodeURIComponent(uid)}`;
    console.log('DELETE URL:', localUrl);
    try {
        const res2 = await fetch(localUrl, { method: 'DELETE' });
        console.log('Local delete status:', res2.status);
        if (res2.ok) {
            return { ok: true, source: 'local', status: res2.status };
        }
        return { ok: false, source: 'local', status: res2.status };
    } catch (e2) {
        console.error('Local admin server not reachable.', e2);
        return { ok: false, source: 'local', error: e2.message };
    }
}

// Replace your external delete attempts with Firestore-only half delete
async function tryDelete(uid) {
    console.log('Half delete: removing Firestore document for uid:', uid);
    await deleteFirestoreUser(uid);
    return { deletedFirestore: true, deletedAuth: false };
}

async function handleDeleteUser(uid) {
    // Set any UI deleting state (spinner/disabled button)
    setDeletingUIState(uid, true);

    try {
        console.log('Attempting half delete (Firestore only) for user:', uid);
        const result = await tryDelete(uid);

        // Update UI to reflect deletion in app data
        removeUserRow(uid);
        toastSuccess('User deleted from app data', `Firestore: ${result.deletedFirestore}, Auth: ${result.deletedAuth} (not deleted)`);

    } catch (err) {
        console.error('Delete user error:', err);
        toastError('Delete failed', err?.message || String(err));
        setDeletingUIState(uid, false); // revert UI to non-deleting state
    }
}

function removeUserRow(uid) {
    // Remove the row or card associated with the user from the admin table/list
    // Adjust selectors to match your markup (e.g., data-user-id or row id)
    const row = document.querySelector(`[data-user-id="${uid}"]`);
    if (row) row.remove();
}

function setDeletingUIState(uid, isDeleting) {
    // Optional: disable delete button and show spinner for that specific user row
    const btn = document.querySelector(`[data-user-id="${uid}"] .delete-btn`);
    if (btn) {
        btn.disabled = isDeleting;
        btn.classList.toggle('is-loading', isDeleting);
    }
}

function toastSuccess(title, message) { console.log('[SUCCESS]', title, message); }
function toastError(title, message) { console.error('[ERROR]', title, message); }