import { Pool } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename=fileURLToPath(import.meta.url),__dirname=path.dirname(__filename);
dotenv.config({path:path.join(__dirname,"..",".env")});
if(!process.env.DATABASE_URL){console.error("DATABASE_URL missing");process.exit(1)}
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try{const r=await pool.query("SELECT NOW() AS now,current_database() AS database");console.log(r.rows[0])}catch(e){console.error("DB ERROR:",e.message);process.exitCode=1}finally{await pool.end()}
