import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";
const __filename=fileURLToPath(import.meta.url),__dirname=path.dirname(__filename);
dotenv.config({path:path.join(__dirname,"..",".env")});
if(!process.env.DATABASE_URL){console.error("DATABASE_URL missing");process.exit(1)}
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const products=JSON.parse(await fs.readFile(path.join(__dirname,"data","seed-products.json"),"utf8"));
try{
 const count=await pool.query("SELECT COUNT(*)::int AS count FROM products");
 if(count.rows[0].count>0) console.log(`Products already exist (${count.rows[0].count}). Nothing seeded.`);
 else for(const p of products) await pool.query("INSERT INTO products(id,name,category,price,size,length,color,occasion,image_url,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[p.id,p.name,p.category,p.price,p.size||"",p.length||"",p.color||"",p.occasion||"",p.image,p.description||""]);
 if(count.rows[0].count===0) console.log(`Seeded ${products.length} PRISHAA products.`);
}catch(e){console.error("SEED ERROR:",e.message);process.exitCode=1}finally{await pool.end()}
