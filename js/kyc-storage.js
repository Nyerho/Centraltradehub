// ... existing code ...
import { auth, storage } from "./firebase-config.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getIdTokenResult } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Helper for KYC uploads (front/back)
// kyc-storage helpers (fix duplicate 'auth' by only using shared storage)
function uploadKycFrontBack(uid, frontFile, backFile) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");

    // Refresh token to avoid stale auth
    await getIdTokenResult(user, true);

    const ts = Date.now();
    const frontName = `${ts}_id_front${guessExt(frontFile)}`;
    const backName = `${ts}_id_back${guessExt(backFile)}`;

    const frontPath = `kyc/${user.uid}/${frontName}`;
    const backPath = `kyc/${user.uid}/${backName}`;

    const frontRef = ref(storage, frontPath);
    const backRef = ref(storage, backPath);

    const metaFront = { contentType: frontFile?.type || "image/png", cacheControl: "private, max-age=0" };
    const metaBack = { contentType: backFile?.type || "image/png", cacheControl: "private, max-age=0" };

    const frontSnap = await uploadBytes(frontRef, frontFile, metaFront);
    const backSnap = await uploadBytes(backRef, backFile, metaBack);

    const frontUrl = await getDownloadURL(frontSnap.ref);
    const backUrl = await getDownloadURL(backSnap.ref);

    return { front: { path: frontPath, url: frontUrl }, back: { path: backPath, url: backUrl } };
}

function guessExt(file) {
    if (!file?.type) return ".png";
    if (file.type.includes("jpeg")) return ".jpg";
    if (file.type.includes("png")) return ".png";
    return ".png";
}

// User upload to kyc/{uid}/filename
export async function uploadKyc(file, filename) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const kycPath = `kyc/${user.uid}/${filename}`;
  const fileRef = ref(storage, kycPath);

  const metadata = {
    contentType: file.type || "application/octet-stream",
    cacheControl: "private, max-age=0"
  };

  const snap = await uploadBytes(fileRef, file, metadata);
  const url = await getDownloadURL(snap.ref);
  return { path: kycPath, url };
}

// List current user's KYC files
export async function getUserKycList() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const userFolder = ref(storage, `kyc/${user.uid}`);
  const out = [];
  const page = await list(userFolder, { maxResults: 1000 });
  for (const item of page.items) {
    const url = await getDownloadURL(item);
    out.push({ path: item.fullPath, url });
  }
  return out;
}

// Admin-only: list all users' KYC files
export async function listAllKyc() {
  const rootRef = ref(storage, "kyc");
  const out = [];

  // List first level: user prefixes (folders)
  const page = await list(rootRef, { maxResults: 1000 });
  for (const prefix of page.prefixes) {
    const userPage = await list(prefix, { maxResults: 1000 });
    for (const item of userPage.items) {
      const url = await getDownloadURL(item);
      out.push({ path: item.fullPath, url });
    }
  }

  return out;
}