const admin = require('firebase-admin');
const path = require('path');

let bucket = null;

function getStorageBucket() {
  if (bucket) return bucket;

  const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'kulunu-3810c.firebasestorage.app',
    });
  }

  bucket = admin.storage().bucket();
  return bucket;
}

// Uploads a Buffer to Firebase Storage and returns a permanent public download URL
async function uploadToFirebase(buffer, mimetype, originalName) {
  const ext = (originalName || 'file').split('.').pop().toLowerCase();
  const destination = `banners/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const storageBucket = getStorageBucket();
  const file = storageBucket.file(destination);

  await file.save(buffer, {
    metadata: { contentType: mimetype },
  });

  await file.makePublic();

  const url = `https://firebasestorage.googleapis.com/v0/b/${storageBucket.name}/o/${encodeURIComponent(destination)}?alt=media`;
  return url;
}

module.exports = { uploadToFirebase };
