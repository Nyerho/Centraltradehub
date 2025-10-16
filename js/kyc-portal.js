// User KYC: Government ID Front/Back only
// Imports must be at top-level (ES module)
import { auth, storage, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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