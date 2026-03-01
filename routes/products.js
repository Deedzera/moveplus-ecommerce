/* ============================================
   MOVE PLUS — Rotas de Produtos
   ============================================ */

const router = require("express").Router();
const { pool } = require("../config/db");
const { requireAdmin } = require("../middleware/auth");
const { uploadArray } = require("../middleware/upload");
const { createProduct, updateProduct } = require("../controllers/productsController");

// GET /api/products — Listar todos (com filtros opcionais)
router.get("/", async (req, res) => {
  try {
    const { category, search, status } = req.query;
    let query = `
      SELECT p.*, c.name AS category_name,
             (
               SELECT string_agg(pi.image_url, ',')
               FROM product_images pi
               WHERE pi.product_id = p.id
             ) AS image_url
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND c.slug = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
    }
    if (status) {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    }

    query += " ORDER BY p.created_at DESC";

    if (req.query.limit) {
      params.push(parseInt(req.query.limit, 10));
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar produtos:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /api/products/slug/:slug — Obter por slug (URLs amigáveis)
router.get("/slug/:slug", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
             (
               SELECT string_agg(pi.image_url, ',')
               FROM product_images pi
               WHERE pi.product_id = p.id
             ) AS image_url
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao obter produto por slug:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /api/products/:id — Obter por ID
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name,
             (
               SELECT string_agg(pi.image_url, ',')
               FROM product_images pi
               WHERE pi.product_id = p.id
             ) AS image_url
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao obter produto:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST /api/products — Criar novo produto (com imagens)
router.post("/", requireAdmin, uploadArray("imagem", 10), createProduct);


// PUT /api/products/:id — Actualizar produto (com imagens)
router.put("/:id", requireAdmin, uploadArray("imagem", 10), updateProduct);
// DELETE /api/products/:id — Eliminar produto
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM products WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }
    res.json({ message: "Produto eliminado com sucesso" });
  } catch (err) {
    console.error("Erro ao eliminar produto:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;
