/* ============================================
   MOVE PLUS — Rotas de Favoritos
   ============================================ */

const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { requireAuth } = require("../middleware/auth");

/**
 * GET /api/favorites
 * Lista todos os favoritos do utilizador logado (com dados do produto + imagem)
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.product_id, f.created_at AS favorited_at,
              p.name, p.price, p.old_price, p.stock, p.tag, p.status,
              c.name AS category_name,
              (SELECT pi.image_url FROM product_images pi
               WHERE pi.product_id = p.id AND pi.is_primary = true
               LIMIT 1) AS image_url
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE f.customer_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar favoritos:", err.message);
    res.status(500).json({ error: "Erro ao listar favoritos." });
  }
});

/**
 * GET /api/favorites/ids
 * Retorna apenas os IDs dos produtos favoritados (para marcar corações na UI)
 */
router.get("/ids", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT product_id FROM favorites WHERE customer_id = $1",
      [req.user.id]
    );
    const ids = result.rows.map((r) => r.product_id);
    res.json(ids);
  } catch (err) {
    console.error("Erro ao listar IDs de favoritos:", err.message);
    res.status(500).json({ error: "Erro ao listar favoritos." });
  }
});

/**
 * POST /api/favorites/:productId
 * Toggle: se já é favorito, remove; se não, adiciona.
 * Retorna { favorited: true/false }
 */
router.post("/:productId", requireAuth, async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) {
    return res.status(400).json({ error: "ID de produto inválido." });
  }

  try {
    // Verificar se o produto existe
    const productCheck = await pool.query(
      "SELECT id FROM products WHERE id = $1",
      [productId]
    );
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    // Verificar se já é favorito
    const existing = await pool.query(
      "SELECT id FROM favorites WHERE customer_id = $1 AND product_id = $2",
      [req.user.id, productId]
    );

    if (existing.rows.length > 0) {
      // Já é favorito → remover
      await pool.query(
        "DELETE FROM favorites WHERE customer_id = $1 AND product_id = $2",
        [req.user.id, productId]
      );
      return res.json({ favorited: false });
    } else {
      // Não é favorito → adicionar
      await pool.query(
        "INSERT INTO favorites (customer_id, product_id) VALUES ($1, $2)",
        [req.user.id, productId]
      );
      return res.json({ favorited: true });
    }
  } catch (err) {
    console.error("Erro ao toggle favorito:", err.message);
    res.status(500).json({ error: "Erro ao atualizar favorito." });
  }
});

/**
 * DELETE /api/favorites/:productId
 * Remove explicitamente um favorito
 */
router.delete("/:productId", requireAuth, async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) {
    return res.status(400).json({ error: "ID de produto inválido." });
  }

  try {
    await pool.query(
      "DELETE FROM favorites WHERE customer_id = $1 AND product_id = $2",
      [req.user.id, productId]
    );
    res.json({ removed: true });
  } catch (err) {
    console.error("Erro ao remover favorito:", err.message);
    res.status(500).json({ error: "Erro ao remover favorito." });
  }
});

module.exports = router;
