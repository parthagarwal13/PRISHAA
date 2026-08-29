import express from "express";
import app from "./backend/server.js";

const server = express();
server.use(app);

export default server;
