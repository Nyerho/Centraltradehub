import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, getDocs, query, where, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function renderKycRequests() {
    const container = document.getElementById('kyc-admin-list');
    if (!container) return;
    container.innerHTML = '<p class="text-muted">Loading KYC requests...</p>';

    try {
        const q = query(collection(db, 'kycRequests'), where('status', '==', 'pending'));
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = '<p class="text-muted">No pending KYC requests.</p>';
            return;
        }

        const cards = [];
        snap.forEach(docSnap => {
            const data = docSnap.data();
            cards.push(`
                <div class="card bg-dark text-white border-secondary mt-3">
                  <div class="card-body">
                    <div class="row">
                      <div class="col-md-8">
                        <div><strong>UID:</strong> ${data.uid || docSnap.id}</div>
                        <div><strong>Email:</strong> ${data.email || ''}</div>
                        <div class="mt-2"><strong>Status:</strong> ${data.status}</div>
                      </div>
                      <div class="col-md-4 text-center">
                        <div>Front</div>
                        <img src="${data.files?.idFrontUrl || ''}" alt="Front" class="img-fluid mb-2 border" />
                        <div>Back</div>
                        <img src="${data.files?.idBackUrl || ''}" alt="Back" class="img-fluid border" />
                      </div>
                    </div>
                    <div class="mt-3 d-flex justify-content-end">
                      <button class="btn btn-success me-2" onclick="approveKyc('${docSnap.id}')">Approve</button>
                      <button class="btn btn-danger" onclick="rejectKyc('${docSnap.id}')">Reject</button>
                    </div>
                  </div>
                </div>
            `);
        });

        container.innerHTML = cards.join('');
    } catch (e) {
        console.error('Failed to load KYC requests', e);
        container.innerHTML = '<p class="text-danger">Error loading KYC requests.</p>';
    }
}

async function setKycStatus(uid, status) {
    try {
        await updateDoc(doc(db, 'kycRequests', uid), {
            status,
            reviewedAt: serverTimestamp(),
            reviewerUid: auth.currentUser?.uid || null
        });
        // Optional: reflect on users collection as well
        await updateDoc(doc(db, 'users', uid), { kycStatus: status }).catch(() => {});
        await renderKycRequests();
    } catch (e) {
        console.error('Failed to update KYC status', e);
        alert('Failed to update status. Check your Firestore rules/admin privileges.');
    }
}

window.approveKyc = (uid) => setKycStatus(uid, 'approved');
window.rejectKyc  = (uid) => setKycStatus(uid, 'rejected');

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, () => renderKycRequests());
});