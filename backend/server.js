import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing. Create .env from .env.example");
  process.exit(1);
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "";

if (!ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) {
  console.error("❌ ADMIN_PASSWORD and ADMIN_SESSION_SECRET are required.");
  console.error("Add them to your .env (local) and Render environment variables (production).");
  process.exit(1);
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
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json({ limit: "15mb" }));

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

  if (!password || !crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD))) {
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
  try { await pool.query("SELECT 1"); res.json({ok:true,database:"connected"}); }
  catch(e){ res.status(500).json({ok:false,error:e.message}); }
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

app.get("/api/products", async (_req,res)=>{ try{res.json(await listProducts())}catch(e){res.status(500).json({error:e.message})} });

app.post("/api/products", requireAdmin, async (req,res)=>{
  try{
    const p=req.body||{};
    if(!p.name?.trim()) return res.status(400).json({error:"Product name is required."});
    if(Number.isNaN(Number(p.price))||Number(p.price)<0) return res.status(400).json({error:"Enter a valid price."});
    if(!p.image?.trim()) return res.status(400).json({error:"Please select a product image."});

    const originalPrice = Number(p.originalPrice ?? p.price);
    const offerActive = !!p.offerActive;
    const offerPercent = Math.max(0, Math.min(100, Number(p.offerPercent || 0)));
    const manualOfferPrice = p.offerPrice == null || p.offerPrice === "" ? null : Number(p.offerPrice);

    if(Number.isNaN(originalPrice) || originalPrice < 0){
      return res.status(400).json({error:"Enter a valid original price."});
    }

    let offerPrice = manualOfferPrice;
    if(offerActive){
      if(offerPrice == null){
        offerPrice = Math.max(0, originalPrice - (originalPrice * offerPercent / 100));
      }
      if(Number.isNaN(offerPrice) || offerPrice < 0 || offerPrice > originalPrice){
        return res.status(400).json({error:"Offer price must be between ₹0 and the original price."});
      }
    }else{
      offerPrice = null;
    }

    const sellingPrice = offerActive ? offerPrice : originalPrice;

    const r=await pool.query(
      `INSERT INTO products(name,category,price,original_price,offer_active,offer_percent,offer_price,size,length,color,occasion,image_url,description)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id,name,category,price,original_price,offer_active,offer_percent,offer_price,size,length,color,occasion,image_url,description,created_at`,
      [
        p.name.trim(), p.category||"Suits", sellingPrice, originalPrice, offerActive,
        offerPercent, offerPrice, p.size?.trim()||"", p.length?.trim()||"",
        p.color?.trim()||"", p.occasion?.trim()||"", p.image.trim(), p.description?.trim()||""
      ]
    );
    res.status(201).json(normalizeProduct(r.rows[0]));
  }catch(e){res.status(500).json({error:e.message})}
});

app.put("/api/products/:id", requireAdmin, async (req,res)=>{
  try{
    const id=Number(req.params.id), p=req.body||{};
    if(!p.name?.trim()) return res.status(400).json({error:"Product name is required."});
    if(Number.isNaN(Number(p.price))||Number(p.price)<0) return res.status(400).json({error:"Enter a valid price."});

    const old=await pool.query("SELECT * FROM products WHERE id=$1",[id]);
    if(!old.rowCount) return res.status(404).json({error:"Product not found."});

    const originalPrice = Number(p.originalPrice ?? old.rows[0].original_price ?? p.price);
    const offerActive = !!p.offerActive;
    const offerPercent = Math.max(0, Math.min(100, Number(p.offerPercent || 0)));
    const manualOfferPrice = p.offerPrice == null || p.offerPrice === "" ? null : Number(p.offerPrice);

    if(Number.isNaN(originalPrice) || originalPrice < 0){
      return res.status(400).json({error:"Enter a valid original price."});
    }

    let offerPrice = manualOfferPrice;
    if(offerActive){
      if(offerPrice == null){
        offerPrice = Math.max(0, originalPrice - (originalPrice * offerPercent / 100));
      }
      if(Number.isNaN(offerPrice) || offerPrice < 0 || offerPrice > originalPrice){
        return res.status(400).json({error:"Offer price must be between ₹0 and the original price."});
      }
    }else{
      offerPrice = null;
    }

    const sellingPrice = offerActive ? offerPrice : originalPrice;
    const image = p.image?.trim() || old.rows[0].image_url;

    const r=await pool.query(
      `UPDATE products
       SET name=$1,category=$2,price=$3,original_price=$4,offer_active=$5,offer_percent=$6,offer_price=$7,
           size=$8,length=$9,color=$10,occasion=$11,image_url=$12,description=$13
       WHERE id=$14
       RETURNING id,name,category,price,original_price,offer_active,offer_percent,offer_price,size,length,color,occasion,image_url,description,created_at`,
      [
        p.name.trim(), p.category||"Suits", sellingPrice, originalPrice, offerActive, offerPercent, offerPrice,
        p.size?.trim()||"", p.length?.trim()||"", p.color?.trim()||"",
        p.occasion?.trim()||"", image, p.description?.trim()||"", id
      ]
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
    let subtotal=0, normalized=[];
    for(const raw of items){
      const qty=Math.max(1,Number(raw.quantity||1)),pid=Number(raw.productId);
      const r=await client.query("SELECT id,name,price FROM products WHERE id=$1",[pid]);
      if(!r.rowCount) throw new Error(`Product ${pid} not found.`);
      const p=r.rows[0],price=Number(p.price); subtotal+=price*qty;
      normalized.push({productId:Number(p.id),productName:p.name,price,quantity:qty});
    }

    const total=subtotal;
    const code=`PRISHAA-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const order=await client.query(`INSERT INTO orders(order_code,customer_name,phone,address,city,state,pincode,total,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Pending') RETURNING id`,[code,c.name.trim(),c.phone.trim(),c.address.trim(),c.city.trim(),c.state.trim(),c.pincode.trim(),total]);
    for(const item of normalized) await client.query("INSERT INTO order_items(order_id,product_id,product_name,price,quantity) VALUES($1,$2,$3,$4,$5)",[Number(order.rows[0].id),item.productId,item.productName,item.price,item.quantity]);
    await client.query("COMMIT");
    res.status(201).json({success:true,orderCode:code,subtotal,discount,total,coupon:appliedCoupon});
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

app.use("/admin", requireAdmin, express.static(path.join(ROOT,"admin")));
app.use("/user",express.static(path.join(ROOT,"user")));
app.get("/",(_req,res)=>res.redirect("/user/"));
app.use(express.static(ROOT));
if (!process.env.VERCEL) {
  app.listen(port,()=>console.log(`PRISHAA running on http://localhost:${port}`));
}

export default app;
