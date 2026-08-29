import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());

// Import your existing backend routes/app
const { default: backendApp } = await import("./backend/server.js");

// Mount existing application
app.use(backendApp);

export default app;