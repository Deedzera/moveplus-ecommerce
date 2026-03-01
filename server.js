/* ============================================
   MOVE PLUS — Server Principal
   ============================================ */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");

// ─── Express ───────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: "https://moveplusao.vercel.app",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Ficheiros Estáticos ───────────────────
app.use(express.static(path.join(__dirname, "public")));

// ─── Rotas da API ──────────────────────────
app.use("/api/products", require("./routes/products"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api/favorites", require("./routes/favorites"));

// ─── Rota dinâmica de produto por slug ─────
app.get("/produto/:slug", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pages", "productPage.html"));
});

// ─── Fallback para páginas HTML ────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Iniciar Servidor (Local apenas) ────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀  Move Plus a correr em http://localhost:${PORT}`);
    console.log(`📦  API disponível em http://localhost:${PORT}/api\n`);
  });
}

// Exportar a app para Serverless Deploy
module.exports = app;
