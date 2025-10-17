// User KYC: Government ID Front/Back only
// Imports must be at top-level (ES module)
import { auth, storage, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class KYCPortal {
    constructor() {
        this.currentUser = null;
        onAuthStateChanged(auth, (user) => {
            this.currentUser = user || null;
            // Check button state on auth changes
            this.checkSubmitButton();
        });
    }

    bindUploadPreviews() {
        const showPreview = (inputId, imgId) => {
            const input = document.getElementById(inputId);
            const img = document.getElementById(imgId);
            if (!input || !img) return;

            input.addEventListener('change', () => {
                const file = input.files?.[0];
                if (file) {
                    img.src = URL.createObjectURL(file);
                    img.style.display = 'block';
                } else {
                    img.src = '';
                    img.style.display = 'none';
                }
                this.checkSubmitButton();
            });
        };

        showPreview('idFrontFileInput', 'idFrontPreview');
        showPreview('idBackFileInput', 'idBackPreview');
    }

    checkSubmitButton() {
        const frontFile = document.getElementById('idFrontFileInput')?.files?.[0];
        const backFile  = document.getElementById('idBackFileInput')?.files?.[0];
        const submitBtn = document.getElementById('submitVerificationBtn');

        if (frontFile && backFile && submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.add('btn-ready');
        } else if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.remove('btn-ready');
        }
    }

    async submitVerification() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'block';

        try {
            if (!this.currentUser) {
                throw new Error("Please sign in before submitting KYC.");
            }

            const frontInput = document.getElementById('idFrontFileInput');
            const backInput  = document.getElementById('idBackFileInput');
            const frontFile = frontInput?.files?.[0];
            const backFile  = backInput?.files?.[0];

            if (!frontFile || !backFile) {
                throw new Error("Both front and back ID images are required.");
            }

            // Upload to Firebase Storage
            const uid = this.currentUser.uid;
            const ts = Date.now();
            const basePath = `kyc/${uid}/`;

            const uploadAndGetUrl = async (file, path) => {
                const r = ref(storage, path);
                await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
                return await getDownloadURL(r);
            };

            const idFrontUrl = await uploadAndGetUrl(frontFile, `${basePath}${ts}_id_front_${frontFile.name}`);
            const idBackUrl  = await uploadAndGetUrl(backFile,  `${basePath}${ts}_id_back_${backFile.name}`);

            // Write Firestore request for admin review
            await setDoc(doc(db, 'kycRequests', uid), {
                uid,
                email: this.currentUser.email || null,
                displayName: this.currentUser.displayName || null,
                status: 'pending',
                submittedAt: serverTimestamp(),
                files: {
                    idFrontUrl,
                    idBackUrl
                }
            }, { merge: true });

            // Optional: reflect status in users collection
            await updateDoc(doc(db, 'users', uid), {
                kycStatus: 'pending',
                kycSubmittedAt: serverTimestamp()
            }).catch(() => { /* ignore if users doc doesn’t exist */ });

            alert('KYC submitted. We will review your verification within 24–48 hours.');
        } catch (err) {
            console.error('KYC submission error:', err);
            alert(err.message || 'Failed to submit KYC.');
        } finally {
            if (overlay) overlay.style.display = 'none';
        }
    }
}

// Expose minimal globals for inline onclick usage (Bootstrap button)
window.submitVerification = () => {
    if (window.kycPortal) {
        window.kycPortal.submitVerification();
    }
};
// If your HTML still calls startKYCVerification inline, define a harmless stub
window.startKYCVerification = () => {};

document.addEventListener('DOMContentLoaded', () => {
    window.kycPortal = new KYCPortal();
    window.kycPortal.bindUploadPreviews();

    // Optional: bind click if you prefer JavaScript-only (no inline onclick)
    const submitBtn = document.getElementById('submitVerificationBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => window.submitVerification());
    }
});

export default KYCPortal;


// Example: after you set the preview src for the selected file
function setKycImagePreview(imgEl, fileUrl) {
  if (!imgEl) return;
  imgEl.src = fileUrl;
  imgEl.classList.add('kyc-image-preview'); // ensure sizing rules apply
}

// Initialize filename-only display (no image preview)
document.addEventListener('DOMContentLoaded', () => {
  attachKycFileNameDisplay();
});

// Hide image previews and show only filename near file inputs
function attachKycFileNameDisplay() {
  const frontInput = document.getElementById('kycFrontFile');
  const backInput  = document.getElementById('kycBackFile');

  // If preview images exist, hide them
  const frontImg = document.getElementById('kycFrontPreview');
  const backImg  = document.getElementById('kycBackPreview');
  if (frontImg) frontImg.style.display = 'none';
  if (backImg)  backImg.style.display  = 'none';

  // Get or create filename display spans
  const frontNameEl = document.getElementById('kycFrontFileName') || createNameEl(frontInput, 'kycFrontFileName');
  const backNameEl  = document.getElementById('kycBackFileName')  || createNameEl(backInput,  'kycBackFileName');

  // Update filename on file selection
  if (frontInput) {
    frontInput.addEventListener('change', () => {
      const f = frontInput.files?.[0];
      frontNameEl.textContent = f ? f.name : 'No file selected';
    });
  }
  if (backInput) {
    backInput.addEventListener('change', () => {
      const f = backInput.files?.[0];
      backNameEl.textContent = f ? f.name : 'No file selected';
    });
  }
}

// Helper to create filename element next to the input if missing
function createNameEl(afterEl, id) {
  const span = document.createElement('span');
  span.id = id;
  span.className = 'text-muted';
  span.style.display = 'inline-block';
  span.style.marginTop = '6px';
  span.textContent = 'No file selected';
  if (afterEl?.parentNode) {
    afterEl.parentNode.insertBefore(span, afterEl.nextSibling);
  }
  return span;
}

// Subscribe to the user's profile doc and reflect KYC status from the authoritative source
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const userDocRef = doc(db, "users", user.uid);
  onSnapshot(userDocRef, (snap) => {
    const data = snap.data() || {};
    const status = data.kycStatus || "pending";
    // Update your UI here; adjust element IDs to match your page
    const badge = document.getElementById("kycStatusBadge") || document.getElementById("kyc-status-text");
    if (badge) {
      badge.textContent = status;
      badge.classList.remove("bg-success","bg-warning","bg-secondary");
      if (status === "approved") badge.classList.add("bg-success");
      else if (status === "pending") badge.classList.add("bg-warning");
      else badge.classList.add("bg-secondary");
    }
    // If you previously set a default "pending" elsewhere after login, remove that code path
    // so it doesn't override the value coming from Firestore.
  });
});