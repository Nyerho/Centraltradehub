// Render admin KYC list and actions
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, getDocs, query, where, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Render pending KYC requests
async function renderKycRequests() {
    const container = document.getElementById('kyc-admin-list');
    if (!container) return;
    container.innerHTML = '<p>Loading KYC requests...</p>';

    try {
        const q = query(collection(db, 'kycRequests'), where('status', '==', 'pending'));
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = '<p>No pending KYC requests.</p>';
            return;
        }

        const items = [];
        snap.forEach(docSnap => {
            const data = docSnap.data();
            items.push(`
                <div class="kyc-card" style="border:1px solid #ddd; padding:12px; margin-bottom:12px;">
                    <div><strong>UID:</strong> ${data.uid || docSnap.id}</div>
                    <div><strong>Email:</strong> ${data.email || ''}</div>
                    <div style="display:flex; gap:12px; margin-top:8px;">
                        <div>
                            <div>Front</div>
                            <img src="${data.files?.idFrontUrl || ''}" alt="Front" style="max-width:180px;" />
                        </div>
                        <div>
                            <div>Back</div>
                            <img src="${data.files?.idBackUrl || ''}" alt="Back" style="max-width:180px;" />
                        </div>
                    </div>
                    <div style="margin-top:12px;">
                        <button onclick="approveKyc('${docSnap.id}')">Approve</button>
                        <button onclick="rejectKyc('${docSnap.id}')" style="margin-left:8px;">Reject</button>
                    </div>
                </div>
            `);
        });

        container.innerHTML = items.join('');
    } catch (e) {
        console.error('Failed to load KYC requests', e);
        container.innerHTML = '<p>Error loading KYC requests.</p>';
    }
}

// Approve/Reject handlers
async function setKycStatus(uid, status) {
    await updateDoc(doc(db, 'kycRequests', uid), {
        status,
        reviewedAt: serverTimestamp(),
        reviewerUid: auth.currentUser?.uid || null
    });
    // Optional: reflect on users collection
    await updateDoc(doc(db, 'users', uid), {
        kycStatus: status
    }).catch(() => {});
    await renderKycRequests();
}

// Expose to window for inline onclick
window.approveKyc = (uid) => setKycStatus(uid, 'approved');
window.rejectKyc  = (uid) => setKycStatus(uid, 'rejected');

// Initialize after auth
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, () => renderKycRequests());
});