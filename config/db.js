const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "1234",
  database: process.env.DB_NAME || "moveplus",
  // Adicionar SSL se não for localhost (Supabase exige SSL)
  ssl: process.env.DB_HOST && process.env.DB_HOST !== "localhost" ? { rejectUnauthorized: false } : false
});

pool.on("error", (err, client) => {
  console.error("❌  Erro inesperado no cliente PostgreSQL (idle client):", err.message);
  process.exit(-1);
});

module.exports = { pool };
