// Render admin KYC list and actions
import { auth, db } from "./firebase-config.js";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function isAdmin() {
    const user = auth.currentUser;
    if (!user) return false;
    const token = await getIdTokenResult(user, true);
    return !!token.claims.admin;
}

export async function renderAdminKyc(targetEl) {
    if (!(await isAdmin())) {
        targetEl.innerHTML = `<div class="alert alert-danger">Admin privileges required to view KYC requests.</div>`;
        return;
    }

    targetEl.innerHTML = `<div class="card border-0 shadow-sm">
        <div class="card-header bg-transparent border-0">
            <h5 class="mb-0">Pending KYC Requests</h5>
        </div>
        <div class="card-body" id="kycRequestsList">Loading...</div>
    </div>`;

    const listEl = targetEl.querySelector("#kycRequestsList");
    const q = query(collection(db, "kycRequests"), where("status", "==", "pending"));
    const snap = await getDocs(q);

    if (snap.empty) {
        listEl.innerHTML = `<p class="text-muted mb-0">No pending KYC requests.</p>`;
        return;
    }

    const items = [];
    snap.forEach(docSnap => {
        const d = docSnap.data();
        const front = d.files?.id_front;
        const back = d.files?.id_back;
        items.push(`
            <div class="row g-3 align-items-start border-bottom pb-3 mb-3">
              <div class="col-md-3">
                <strong>User:</strong> ${d.uid}
              </div>
              <div class="col-md-4">
                <div class="d-flex gap-3">
                  <div><div class="text-muted small">ID Front</div><img src="${front}" alt="ID Front" class="img-fluid rounded border" /></div>
                  <div><div class="text-muted small">ID Back</div><img src="${back}" alt="ID Back" class="img-fluid rounded border" /></div>
                </div>
              </div>
              <div class="col-md-5">
                <div class="d-flex gap-2">
                  <button class="btn btn-success btn-sm" data-action="approve" data-uid="${d.uid}"><i class="fas fa-check me-1"></i>Approve</button>
                  <button class="btn btn-danger btn-sm" data-action="reject" data-uid="${d.uid}"><i class="fas fa-times me-1"></i>Reject</button>
                </div>
              </div>
            </div>
        `);
    });
    listEl.innerHTML = items.join("");

    listEl.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const uid = btn.getAttribute("data-uid");
        const action = btn.getAttribute("data-action");
        if (!uid || !action) return;

        if (action === "approve") {
            await approveKyc(uid);
            btn.closest(".row").remove();
        } else if (action === "reject") {
            const reason = prompt("Enter rejection reason (optional):") || null;
            await rejectKyc(uid, reason);
            btn.closest(".row").remove();
        }
    });
}

export async function approveKyc(uid) {
    const ref = doc(db, "kycRequests", uid);
    await updateDoc(ref, {
        status: "approved",
        reviewedBy: auth.currentUser?.uid || null,
        reviewedAt: serverTimestamp()
    });
}

export async function rejectKyc(uid, reason) {
    const ref = doc(db, "kycRequests", uid);
    await updateDoc(ref, {
        status: "rejected",
        reviewedBy: auth.currentUser?.uid || null,
        reviewedAt: serverTimestamp(),
        rejectionReason: reason || null
    });
}