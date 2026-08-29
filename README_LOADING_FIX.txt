PRISHAA FINAL LOADING FIX

What was fixed:
1. The user page no longer stays forever on "Opening PRISHAA...".
2. The website now shows the real API/database error and a Try Again button.
3. Missing Vercel environment variables no longer cause a silent endless frontend loop.
4. Added /api/health for diagnostics.
5. Global homepage offer/coupon remains removed; per-product offers remain.

IMPORTANT VERCEL ENVIRONMENT VARIABLES:
DATABASE_URL
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

After adding/changing variables: Deployments -> Redeploy.
