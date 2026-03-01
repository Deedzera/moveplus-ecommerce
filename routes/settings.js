const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { requireAdmin } = require("../middleware/auth");
const { uploadSettingsImages } = require("../middleware/upload");

// GET /api/settings — Retrieve global store settings
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings ORDER BY id ASC LIMIT 1");
    if (result.rows.length === 0) {
      // Return defaults if not yet initialized
      return res.json({
        shop_name: "Move Plus",
        shop_slogan: "A tua loja online de confiança. Perfumes, cremes, roupa e acessórios — tudo ao melhor preço com entrega rápida.",
        shop_email: "info@moveplus.ao",
        shop_whatsapp: "+244 999 999 999",
        shop_location: "Luanda, Angola",
        social_instagram: "#",
        social_facebook: "#",
        social_tiktok: "#",
        primary_color: "#b8860b",
        delivery_fee: 500,
        free_delivery_threshold: 10000,
        delivery_time: "24-48 horas"
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao obter definicoes:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// PUT /api/settings — Update global store settings
router.put("/", requireAdmin, async (req, res) => {
  try {
    const {
      shop_name, shop_slogan, shop_email, shop_whatsapp, shop_location,
      social_instagram, social_facebook, social_tiktok,
      primary_color, delivery_fee, free_delivery_threshold, delivery_time
    } = req.body;

    // Check if settings row exists
    const checkResult = await pool.query("SELECT id FROM settings ORDER BY id ASC LIMIT 1");

    let queryText;
    let params = [
      shop_name, shop_slogan, shop_email, shop_whatsapp, shop_location,
      social_instagram, social_facebook, social_tiktok,
      primary_color, delivery_fee, free_delivery_threshold, delivery_time
    ];

    if (checkResult.rows.length === 0) {
      // Insert if it's the first time
      queryText = `
        INSERT INTO settings (
          shop_name, shop_slogan, shop_email, shop_whatsapp, shop_location,
          social_instagram, social_facebook, social_tiktok,
          primary_color, delivery_fee, free_delivery_threshold, delivery_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`;
    } else {
      // Update the existing row
      const id = checkResult.rows[0].id;
      queryText = `
        UPDATE settings SET
          shop_name = $1, shop_slogan = $2, shop_email = $3, shop_whatsapp = $4, shop_location = $5,
          social_instagram = $6, social_facebook = $7, social_tiktok = $8,
          primary_color = $9, delivery_fee = $10, free_delivery_threshold = $11, delivery_time = $12
        WHERE id = $13
        RETURNING *`;
      params.push(id);
    }

    const result = await pool.query(queryText, params);
    res.json(result.rows[0]);

  } catch (err) {
    console.error("Erro ao atualizar definicoes:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST /api/settings/images — Upload hero / login images via Cloudinary
router.post("/images", requireAdmin, uploadSettingsImages(), async (req, res) => {
  try {
    const updates = [];
    const params  = [];
    let idx = 1;

    // hero_image
    if (req.files && req.files.hero_image && req.files.hero_image[0]) {
      updates.push(`hero_image_url = $${idx++}`);
      params.push(req.files.hero_image[0].path); // Cloudinary URL
    }

    // login_image
    if (req.files && req.files.login_image && req.files.login_image[0]) {
      updates.push(`login_image_url = $${idx++}`);
      params.push(req.files.login_image[0].path); // Cloudinary URL
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }

    // Ensure settings row exists
    await pool.query(`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);

    const queryText = `UPDATE settings SET ${updates.join(", ")} WHERE id = 1 RETURNING *`;
    const result = await pool.query(queryText, params);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao guardar imagens das settings:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;
