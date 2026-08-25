# PRISHAA — Vercel Deployment

This package uses the same Express + Neon backend and is prepared for Vercel.
Vercel supports Express apps directly, so no separate frontend host is required.

## 1. GitHub
Push the entire folder to your GitHub repository.

Do NOT commit `.env`.

## 2. Vercel
Import the GitHub repository as a new Vercel project.
Keep Root Directory blank if `package.json` is at the repository root.

Build command:
npm install

Start command:
Vercel detects the root `server.js` Express entrypoint.

## 3. Environment Variables
In Vercel Project → Settings → Environment Variables, add:

DATABASE_URL=your Neon connection string
ADMIN_PASSWORD=your admin password
ADMIN_SESSION_SECRET=your long random secret
NODE_ENV=production

Redeploy after adding/changing environment variables.

## 4. URLs
User:
https://YOUR-PROJECT.vercel.app/user/

Admin:
https://YOUR-PROJECT.vercel.app/admin/

API:
https://YOUR-PROJECT.vercel.app/api/health

## 5. Local
npm install
npm start

The same Express app still works locally.

Important:
Keep secrets only in environment variables. Never put DATABASE_URL or ADMIN_PASSWORD into frontend JavaScript or GitHub.
