/* ============================================
   MOVE PLUS — Rotas de Categorias
   ============================================ */

const router = require("express").Router();
const { pool } = require("../config/db");
const { requireAdmin } = require("../middleware/auth");

// GET /api/categories — Listar todas (com contagem de produtos)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar categorias:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /api/categories/:id — Obter por ID
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categories WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Categoria não encontrada" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao obter categoria:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST /api/categories — Criar categoria
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, slug, icon, image_url, size_type } = req.body;
    const result = await pool.query(
      `INSERT INTO categories (name, slug, icon, image_url, size_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, slug, icon || "", image_url || "", size_type || "none"]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao criar categoria:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// PUT /api/categories/:id — Actualizar categoria
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { name, slug, icon, image_url, size_type } = req.body;
    const result = await pool.query(
      `UPDATE categories
       SET name = $1, slug = $2, icon = $3, image_url = $4, size_type = $5
       WHERE id = $6
       RETURNING *`,
      [name, slug, icon || "", image_url || "", size_type || "none", req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Categoria não encontrada" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao actualizar categoria:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE /api/categories/:id — Eliminar categoria
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM categories WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Categoria não encontrada" });
    }
    res.json({ message: "Categoria eliminada com sucesso" });
  } catch (err) {
    console.error("Erro ao eliminar categoria:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;
