# RangRiwaz deploy on Render + Neon

## 1. Push this folder to GitHub
Create a GitHub repository, then upload all files in this folder.

## 2. Render
Render Dashboard -> New -> Web Service -> connect the GitHub repo.

Use:
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Plan: Free

## 3. Environment variable
In Render -> Environment add:
- `DATABASE_URL` = your Neon PostgreSQL connection string
- `RAZORPAY_KEY_ID` = your Razorpay Test Mode Key ID
- `RAZORPAY_KEY_SECRET` = your Razorpay Test Mode Key Secret
- `NODE_ENV` = `production`

Do NOT commit `.env`, payment keys, or the Neon password. Start with Razorpay Test Mode keys and switch to Live Mode keys only after a successful test checkout.

## 4. Deploy
Click Create Web Service / Deploy.
Render will build and start the Express server.

## 5. Open the app
User:
`https://YOUR-RENDER-URL/user/`

Admin:
`https://YOUR-RENDER-URL/admin/`

The same deployed server serves both panels and uses the Neon database.

## Important
The admin panel is currently not protected by login/authentication. Add admin authentication before sharing the admin URL publicly.


ADMIN AUTHENTICATION:
Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in .env locally and in Render Environment Variables. The /admin/ page requires the password; admin API writes and order viewing are protected server-side.
