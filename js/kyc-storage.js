// ... existing code ...
import { auth, storage } from "./firebase-config.js";
import { ref, uploadBytes, getDownloadURL, list } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
// ... existing code ...