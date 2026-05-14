// Migration: add loginMethod and isGoogleVerified to existing users
// Run: node backend/scripts/migrate-login-method.js
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db.json');

if (!fs.existsSync(DB_PATH)) {
  console.log('[Migration] db.json not found. Nothing to migrate.');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const users = data.users || [];
let updated = 0;

for (const user of users) {
  let changed = false;

  // Determine login method
  if (!user.loginMethod) {
    if (user.googleId) {
      user.loginMethod = 'google';
      user.isGoogleVerified = true;
    } else {
      user.loginMethod = 'code';
      user.isGoogleVerified = false;
    }
    changed = true;
  }

  // Ensure isGoogleVerified is set for google users
  if (user.loginMethod === 'google' && !user.isGoogleVerified) {
    user.isGoogleVerified = true;
    changed = true;
  }

  // Ensure isGoogleVerified is false for code users
  if (user.loginMethod === 'code' && user.isGoogleVerified === undefined) {
    user.isGoogleVerified = false;
    changed = true;
  }

  if (changed) updated++;
}

// Add isHidden field to existing shared photos
const photos = data.sharedPhotos || [];
let photosUpdated = 0;
for (const photo of photos) {
  if (photo.isHidden === undefined) {
    photo.isHidden = false;
    photosUpdated++;
  }
}

data.users = users;
data.sharedPhotos = photos;
fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

console.log(`[Migration] Done. Updated ${updated} users, ${photosUpdated} photos.`);
