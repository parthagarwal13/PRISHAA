# PRISHAA + Neon Backend Ready

## 1. Add your Neon connection string

Copy `.env.example` to `.env` and put the Neon connection string in `DATABASE_URL`. Keep `.env` private.

## 2. Install packages

```bash
npm install
```

## 3. Check the connection

```bash
npm run check
```

## 4. Seed the existing PRISHAA catalogue

```bash
npm run seed
```

If the products table is empty, this loads the current sample products into Neon.

## 5. Start

```bash
npm start
```

Then open `http://localhost:8787/user/` and `http://localhost:8787/admin/`.

### Shared backend now
- Admin product add/edit/delete -> Neon
- User catalogue -> Neon
- User checkout -> Neon orders + order_items
- Admin order status/delete -> Neon
- Optional product length -> Neon

### Images
Compressed image data is stored in `products.image_url` for this first version. For a larger production catalogue, move image storage to object storage and keep only the URL in Neon.

### Admin security
Admin authentication has NOT been added yet. Add login/auth before making the admin URL public.


ADMIN AUTHENTICATION:
Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in .env locally and in Render Environment Variables. The /admin/ page requires the password; admin API writes and order viewing are protected server-side.
