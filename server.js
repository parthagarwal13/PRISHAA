import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";




const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Works whether server.js is in the project root or inside /backend.
const rootCandidate = path.resolve(__dirname, "..");
const ROOT =
  (fs.existsSync(path.join(__dirname, "user")) && fs.existsSync(path.join(__dirname, "admin")))
    ? __dirname
    : rootCandidate;

dotenv.config({ path: path.join(ROOT, ".env") });
const DATABASE_URL = process.env.DATABASE_URL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";

if (!DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add it in Vercel Environment Variables.");
}
if (!ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
  console.error("Admin environment variables are missing. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel.");
}

function createAdminToken() {
  const payload = `${Date.now()}.${crypto.randomBytes(24).toString("hex")}`;
  const sig = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function validAdminToken(token) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [ts, nonce, sig] = parts;
  const payload = `${ts}.${nonce}`;
  const expected = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payload).digest("hex");

  if (!/^[0-9]+$/.test(ts)) return false;
  if (Date.now() - Number(ts) > 1000 * 60 * 60 * 12) return false; // 12 hours
  if (Date.now() < Number(ts)) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function requireAdmin(req, res, next) {
  if (validAdminToken(getCookie(req, "prishaa_admin_session"))) {
    return next();
  }

  const wantsJson =
    req.path.startsWith("/api/") ||
    (req.headers.accept || "").includes("application/json");

  if (wantsJson) return res.status(401).json({ error: "Admin authentication required." });
  return res.redirect("/admin/");
}

const app = express();
const port = Number(process.env.PORT || 8787);
const pool = new Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 10000
});

// Automatically add the offer columns to the existing products table.
// Existing products keep their current price as original_price.
const schemaReady = pool.query(`
  ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2);
  ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_active BOOLEAN DEFAULT FALSE;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_percent NUMERIC(5,2) DEFAULT 0;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_price NUMERIC(12,2);

  UPDATE products
  SET
    original_price = COALESCE(original_price, price),
    offer_active = COALESCE(offer_active, FALSE),
    offer_percent = COALESCE(offer_percent, 0)
  WHERE original_price IS NULL
     OR offer_active IS NULL
     OR offer_percent IS NULL;
`).catch((error) => {
  console.error("Database schema setup failed:", error.message);
  throw error;
});

app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (_req, res) => {
  if (!DATABASE_URL) {
    return res.status(500).json({ ok:false, error:"DATABASE_URL is missing in Vercel Environment Variables." });
  }
  res.json({ ok:true });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const normalizeProduct = row => ({
  id: Number(row.id), name: row.name, category: row.category,
  price: Number(row.price), originalPrice: Number(row.original_price ?? row.price), offerActive: !!row.offer_active, offerPercent: Number(row.offer_percent || 0), offerPrice: row.offer_price != null ? Number(row.offer_price) : null, size: row.size || "", length: row.length || "",
  color: row.color || "", occasion: row.occasion || "", image: row.image_url,
  description: row.description || "", createdAt: row.created_at
});

async function listProducts(){
  await schemaReady;
  const r = await pool.query("SELECT id,name,category,price,original_price,offer_active,offer_percent,offer_price,size,length,color,occasion,image_url,description,created_at FROM products ORDER BY created_at DESC,id DESC");
  return r.rows.map(normalizeProduct);
}

async function listOrders(){
  const o = await pool.query("SELECT id,order_code,customer_name,phone,address,city,state,pincode,total,status,created_at FROM orders ORDER BY created_at DESC,id DESC");
  const i = await pool.query("SELECT order_id,product_id,product_name,price,quantity FROM order_items ORDER BY id ASC");
  const map = new Map();
  for(const row of i.rows){
    const id=Number(row.order_id); if(!map.has(id)) map.set(id,[]);
    map.get(id).push({productId:Number(row.product_id),productName:row.product_name,price:Number(row.price),quantity:Number(row.quantity)});
  }
  return o.rows.map(row=>({
    id:Number(row.id), orderCode:row.order_code, customerName:row.customer_name,
    phone:row.phone, address:row.address, city:row.city, state:row.state,
    pincode:row.pincode, total:Number(row.total), status:row.status,
    items:map.get(Number(row.id))||[], createdAt:row.created_at
  }));
}


app.get("/admin/", (req, res) => {
  if (validAdminToken(getCookie(req, "prishaa_admin_session"))) {
    return res.sendFile(path.join(ROOT, "admin", "index.html"));
  }
  return res.sendFile(path.join(ROOT, "admin", "login.html"));
});

app.post("/admin/login", express.urlencoded({ extended: false }), (req, res) => {
  const password = String(req.body?.password || "");

  if (!password) {
    return res.status(401).sendFile(path.join(ROOT, "admin", "login.html"));
  }

  const passwordBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(ADMIN_PASSWORD);
  const passwordValid =
    passwordBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(passwordBuffer, expectedBuffer);

  if (!passwordValid) {
    return res.status(401).sendFile(path.join(ROOT, "admin", "login.html"));
  }

  const token = createAdminToken();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `prishaa_admin_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200${secure}`
  );
  return res.redirect("/admin/");
});

app.post("/admin/logout", (req, res) => {
  res.setHeader("Set-Cookie", "prishaa_admin_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  res.redirect("/admin/");
});

app.get("/api/health", async (_req,res)=>{
  try {
    await schemaReady;
    await pool.query("SELECT 1");
    res.json({
      ok: true,
      database: "connected",
      root: ROOT
    });
  } catch(e) {
    res.status(500).json({ok:false,error:e.message});
  }
});

app.post("/api/upload-image", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded." });
    }

    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Only image files are allowed." });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "prishaa/products",
          resource_type: "image"
        },
        (error, uploaded) => {
          if (error) reject(error);
          else resolve(uploaded);
        }
      );

      stream.end(req.file.buffer);
    });

    return res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (e) {
    console.error("Cloudinary upload error:", e);
    return res.status(500).json({ error: e.message || "Image upload failed." });
  }
});

app.get("/api/products", async (_req,res)=>{
  try{
    if(!DATABASE_URL) return res.status(500).json({error:"DATABASE_URL is missing in Vercel Environment Variables."});
    res.json(await listProducts());
  }catch(e){
    console.error("GET /api/products failed:", e);
    res.status(500).json({error:e.message || "Database connection failed."});
  }
});

app.post("/api/products", requireAdmin, async (req,res)=>{
  try{
    await schemaReady;
    const p=req.body||{};
    if(!p.name?.trim()) return res.status(400).json({error:"Product name is required."});
    if(!p.image?.trim()) return res.status(400).json({error:"Please select a product image."});

    const originalPrice=Number(p.originalPrice ?? p.price);
    const offerActive=!!p.offerActive;
    const offerPercent=Math.max(0,Math.min(100,Number(p.offerPercent||0)));
    let offerPrice=(p.offerPrice===""||p.offerPrice==null)?null:Number(p.offerPrice);

    if(!Number.isFinite(originalPrice)||originalPrice<0)
      return res.status(400).json({error:"Enter a valid original price."});

    if(offerActive){
      if(offerPrice==null && offerPercent>0)
        offerPrice=Math.max(0,originalPrice-(originalPrice*offerPercent/100));
      if(offerPrice==null) offerPrice=originalPrice;
      if(!Number.isFinite(offerPrice)||offerPrice<0||offerPrice>originalPrice)
        return res.status(400).json({error:"Offer price must be between ₹0 and the original price."});
    }else{
      offerPrice=null;
    }

    const sellingPrice=offerActive?offerPrice:originalPrice;

    const r=await pool.query(
      `INSERT INTO products(name,category,price,original_price,offer_active,offer_percent,offer_price,size,length,color,occasion,image_url,description)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id,name,category,price,original_price,offer_active,offer_percent,offer_price,size,length,color,occasion,image_url,description,created_at`,
      [p.name.trim(),p.category||"Lehengas",sellingPrice,originalPrice,offerActive,offerPercent,offerPrice,p.size?.trim()||"",p.length?.trim()||"",p.color?.trim()||"",p.occasion?.trim()||"",p.image.trim(),p.description?.trim()||""]
    );
    res.status(201).json(normalizeProduct(r.rows[0]));
  }catch(e){res.status(500).json({error:e.message})}
});

app.put("/api/products/:id", requireAdmin, async (req,res)=>{
  try{
    await schemaReady;
    const id=Number(req.params.id),p=req.body||{};
    if(!p.name?.trim()) return res.status(400).json({error:"Product name is required."});

    const old=await pool.query("SELECT * FROM products WHERE id=$1",[id]);
    if(!old.rowCount) return res.status(404).json({error:"Product not found."});

    const originalPrice=Number(p.originalPrice ?? old.rows[0].original_price ?? p.price);
    const offerActive=!!p.offerActive;
    const offerPercent=Math.max(0,Math.min(100,Number(p.offerPercent||0)));
    let offerPrice=(p.offerPrice===""||p.offerPrice==null)?null:Number(p.offerPrice);

    if(!Number.isFinite(originalPrice)||originalPrice<0)
      return res.status(400).json({error:"Enter a valid original price."});

    if(offerActive){
      if(offerPrice==null && offerPercent>0)
        offerPrice=Math.max(0,originalPrice-(originalPrice*offerPercent/100));
      if(offerPrice==null) offerPrice=originalPrice;
      if(!Number.isFinite(offerPrice)||offerPrice<0||offerPrice>originalPrice)
        return res.status(400).json({error:"Offer price must be between ₹0 and the original price."});
    }else{
      offerPrice=null;
    }

    const sellingPrice=offerActive?offerPrice:originalPrice;
    const image=p.image?.trim()||old.rows[0].image_url;

    const r=await pool.query(
      `UPDATE products SET name=$1,category=$2,price=$3,original_price=$4,offer_active=$5,offer_percent=$6,offer_price=$7,size=$8,length=$9,color=$10,occasion=$11,image_url=$12,description=$13
       WHERE id=$14
       RETURNING id,name,category,price,original_price,offer_active,offer_percent,offer_price,size,length,color,occasion,image_url,description,created_at`,
      [p.name.trim(),p.category||"Lehengas",sellingPrice,originalPrice,offerActive,offerPercent,offerPrice,p.size?.trim()||"",p.length?.trim()||"",p.color?.trim()||"",p.occasion?.trim()||"",image,p.description?.trim()||"",id]
    );
    res.json(normalizeProduct(r.rows[0]));
  }catch(e){res.status(500).json({error:e.message})}
});

app.delete("/api/products/:id", requireAdmin, async (req,res)=>{
  try{
    const r=await pool.query("DELETE FROM products WHERE id=$1 RETURNING id",[Number(req.params.id)]);
    if(!r.rowCount) return res.status(404).json({error:"Product not found."});
    res.json({success:true});
  }catch(e){res.status(500).json({error:e.message})}
});

app.get("/api/orders", requireAdmin, async (_req,res)=>{try{res.json(await listOrders())}catch(e){res.status(500).json({error:e.message})}});

app.post("/api/orders", async (req,res)=>{
  const c=req.body?.customer||{},items=Array.isArray(req.body?.items)?req.body.items:[];
  if(!c.name?.trim()||!c.phone?.trim()||!c.address?.trim()||!c.city?.trim()||!c.state?.trim()||!c.pincode?.trim()) return res.status(400).json({error:"Please fill all customer and delivery details."});
  if(!items.length) return res.status(400).json({error:"Cart is empty."});
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    let total=0, normalized=[];
    for(const raw of items){
      const qty=Math.max(1,Number(raw.quantity||1)),pid=Number(raw.productId);
      const r=await client.query("SELECT id,name,price FROM products WHERE id=$1",[pid]);
      if(!r.rowCount) throw new Error(`Product ${pid} not found.`);
      const p=r.rows[0],price=Number(p.price); total+=price*qty;
      normalized.push({productId:Number(p.id),productName:p.name,price,quantity:qty});
    }
    const code=`PRISHAA-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const order=await client.query(`INSERT INTO orders(order_code,customer_name,phone,address,city,state,pincode,total,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Pending') RETURNING id`,[code,c.name.trim(),c.phone.trim(),c.address.trim(),c.city.trim(),c.state.trim(),c.pincode.trim(),total]);
    for(const item of normalized) await client.query("INSERT INTO order_items(order_id,product_id,product_name,price,quantity) VALUES($1,$2,$3,$4,$5)",[Number(order.rows[0].id),item.productId,item.productName,item.price,item.quantity]);
    await client.query("COMMIT"); res.status(201).json({success:true,orderCode:code,total});
  }catch(e){await client.query("ROLLBACK");res.status(500).json({error:e.message})}finally{client.release()}
});

app.put("/api/orders/:id/status", requireAdmin, async (req,res)=>{
  try{
    const allowed=new Set(["Pending","Confirmed","Packed","Shipped","Delivered","Cancelled"]),status=req.body?.status;
    if(!allowed.has(status)) return res.status(400).json({error:"Invalid status."});
    const r=await pool.query("UPDATE orders SET status=$1 WHERE id=$2 RETURNING id",[status,Number(req.params.id)]);
    if(!r.rowCount) return res.status(404).json({error:"Order not found."}); res.json({success:true});
  }catch(e){res.status(500).json({error:e.message})}
});

app.delete("/api/orders/:id", requireAdmin, async (req,res)=>{
  try{const r=await pool.query("DELETE FROM orders WHERE id=$1 RETURNING id",[Number(req.params.id)]);if(!r.rowCount)return res.status(404).json({error:"Order not found."});res.json({success:true})}catch(e){res.status(500).json({error:e.message})}
});

// Frontend routes
app.use("/user", express.static(path.join(ROOT, "user")));

app.get("/user", (_req, res) => {
  res.sendFile(path.join(ROOT, "user", "index.html"));
});

app.get("/user/", (_req, res) => {
  res.sendFile(path.join(ROOT, "user", "index.html"));
});

app.get("/admin/", (req, res) => {
  if (validAdminToken(getCookie(req, "prishaa_admin_session"))) {
    return res.sendFile(path.join(ROOT, "admin", "index.html"));
  }
  return res.sendFile(path.join(ROOT, "admin", "login.html"));
});

app.use("/admin", requireAdmin, express.static(path.join(ROOT, "admin")));

app.get("/", (_req, res) => res.redirect("/user/"));

app.use(express.static(ROOT));

// Helpful fallback: never expose API routes as HTML.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found." });
  }
  return res.status(404).send("Page not found.");
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`PRISHAA running on http://localhost:${port}`);
    console.log(`Project root: ${ROOT}`);
  });
}

export default app;
