# Shawarma Time Firebase Admin Setup

The website is ready for GitHub Pages with a real `/admin/` route.

The admin dashboard saves homepage content, banners, menu items, offers, gallery images, restaurant contact details and opening hours into Firestore. Uploaded JPG, PNG and WEBP images are stored in Cloudinary, then the Cloudinary image URLs are saved into Firestore. The public website subscribes to Firestore updates for live refreshes.

## Firebase Services

Enable these Firebase products:

- Authentication: Email/password provider
- Firestore Database

Firebase Storage is not required. The project can stay on the Firebase Spark plan because image uploads use Cloudinary instead.

## Configure The Website

Open:

```text
src/firebaseConfig.js
```

Paste your Firebase web app config:

```js
export const firebaseConfig = {
  apiKey: "configured in src/firebaseConfig.js",
  authDomain: "shawarma-time-ca124.firebaseapp.com",
  projectId: "shawarma-time-ca124",
  storageBucket: "shawarma-time-ca124.firebasestorage.app",
  messagingSenderId: "610999682916",
  appId: "1:610999682916:web:95e48d19aeb26fd6761c71"
};
```

Firebase config is public by design. Do not put service account keys in this website.

The admin dashboard requires this config in production. It does not use browser storage as the production admin database.

## Default Admin Login

Admin URL:

```text
https://must66.github.io/shawarmatime/admin/
```

Default username:

```text
admin
```

Default password:

```text
Shawarma2026!
```

The admin page maps username `admin` to the internal Firebase Auth email:

```text
admin@shawarma-time.local
```

If that user does not exist yet, the admin page creates it the first time the default username/password are used.

## Firestore Rules

Use the included `firestore.rules` as the base rules. They allow public reads of site content and restrict writes to authenticated active admins.

## Cloudinary Image Uploads

Create a Cloudinary unsigned upload preset:

1. Open Cloudinary Dashboard.
2. Go to Settings > Upload.
3. Add an unsigned upload preset.
4. Restrict it to images if available.
5. Copy your Cloud name and preset name.

Open:

```text
src/cloudinaryConfig.js
```

Fill:

```js
export const cloudinaryConfig = {
  cloudName: "YOUR_CLOUD_NAME",
  uploadPreset: "YOUR_UNSIGNED_UPLOAD_PRESET",
  folder: "shawarma-time"
};
```

Do not put Cloudinary API secrets in frontend code. Only the cloud name and unsigned upload preset belong here.

## Deploy Rules

After selecting the existing Firebase project locally, deploy the rules with:

```powershell
firebase deploy --only firestore:rules
```

The included `firebase.json` points Firebase CLI to `firestore.rules`.

If login shows `Enable Email/Password sign-in in Firebase Authentication`, open Firebase Console > Authentication > Sign-in method and enable Email/Password.
