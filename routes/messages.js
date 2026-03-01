/* ============================================
   MOVE PLUS — Rotas de Mensagens
   ============================================ */

const router = require("express").Router();
const { pool } = require("../config/db");
const { requireAdmin } = require("../middleware/auth");

// GET /api/messages — Listar todas
router.get("/", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM messages ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar mensagens:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST /api/messages — Criar mensagem
router.post("/", async (req, res) => {
  try {
    const { customer_name, phone, text } = req.body;
    const result = await pool.query(
      `INSERT INTO messages (customer_name, phone, text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [customer_name, phone, text]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao criar mensagem:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE /api/messages/:id — Eliminar mensagem
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM messages WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Mensagem não encontrada" });
    }
    res.json({ message: "Mensagem eliminada com sucesso" });
  } catch (err) {
    console.error("Erro ao eliminar mensagem:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;
