/* ============================================
   MOVE PLUS — Rotas de Encomendas
   ============================================ */

const router = require("express").Router();
const { pool } = require("../config/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// GET /api/orders — Listar todas (com filtro por estado ou cliente)
router.get("/", requireAuth, async (req, res) => {
  try {
    let { status, customer_id } = req.query;

    if (req.user.role !== "admin") {
      if (customer_id && String(customer_id) !== String(req.user.id)) {
        return res.status(403).json({ error: "Acesso negado. Só podes ver as tuas próprias encomendas." });
      }
      customer_id = req.user.id;
    }
    let query = `
      SELECT o.*, cu.name AS customer_name, cu.phone AS customer_phone,
             (
               SELECT string_agg(
                 oi.quantity || 'x ' || COALESCE(p.name, 'Produto Movido') || 
                 CASE WHEN oi.variation IS NOT NULL AND oi.variation != '' THEN ' (' || oi.variation || ')' ELSE '' END, 
                 ', '
               )
               FROM order_items oi
               LEFT JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = o.id
             ) AS items_text
      FROM orders o
      LEFT JOIN customers cu ON o.customer_id = cu.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }
    
    if (customer_id) {
      params.push(customer_id);
      query += ` AND o.customer_id = $${params.length}`;
    }

    query += " ORDER BY o.created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar encomendas:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET /api/orders/:id — Obter por ID
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, cu.name AS customer_name, cu.phone AS customer_phone,
             (
               SELECT string_agg(
                 oi.quantity || 'x ' || COALESCE(p.name, 'Produto Movido') || 
                 CASE WHEN oi.variation IS NOT NULL AND oi.variation != '' THEN ' (' || oi.variation || ')' ELSE '' END, 
                 ', '
               )
               FROM order_items oi
               LEFT JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = o.id
             ) AS items_text
       FROM orders o
       LEFT JOIN customers cu ON o.customer_id = cu.id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Encomenda não encontrada" });
    }
    const order = result.rows[0];
    if (req.user.role !== "admin" && String(order.customer_id) !== String(req.user.id)) {
      return res.status(403).json({ error: "Acesso negado." });
    }
    res.json(order);
  } catch (err) {
    console.error("Erro ao obter encomenda:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST /api/orders — Criar encomenda
router.post("/", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { items, delivery_option } = req.body;
    const customer_id = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Carrinho vazio ou formato inválido." });
    }

    await client.query("BEGIN"); // Iniciar Transacção

    let calculatedTotal = 0;
    let generatedItemsTextParts = [];
    let orderItemsToInsert = [];

    // Processar cada item do carrinho
    for (const item of items) {
      const prodRes = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [item.id]);
      if (prodRes.rows.length === 0) {
        throw new Error(`Produto não encontrado (ID: ${item.id})`);
      }
      
      const prod = prodRes.rows[0];

      if (prod.stock < item.qty) {
        throw new Error(`Stock insuficiente para o produto: ${prod.name}. (Em stock: ${prod.stock || 0})`);
      }

      calculatedTotal += Number(prod.price) * item.qty;
      generatedItemsTextParts.push(`${item.qty}x ${prod.name} ${item.variation ? `(${item.variation})` : ""}`);

      orderItemsToInsert.push({
         product_id: item.id,
         variation: item.variation,
         qty: item.qty,
         price: Number(prod.price)
      });

      // Deduzir stock
      await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.qty, item.id]);
    }

    // Processar Custos de Entrega baseado nas definições
    let deliveryMessage = "Levantamento na Loja";
    if (delivery_option === "delivery") {
      const settingsResult = await client.query("SELECT delivery_fee, free_delivery_threshold FROM settings ORDER BY id ASC LIMIT 1");
      const settings = settingsResult.rows[0] || { delivery_fee: 500, free_delivery_threshold: 0 };
      
      let deliveryFee = Number(settings.delivery_fee) || 0;
      if (settings.free_delivery_threshold > 0 && calculatedTotal >= Number(settings.free_delivery_threshold)) {
        deliveryFee = 0;
      }
      calculatedTotal += deliveryFee;
      deliveryMessage = deliveryFee === 0 ? "Entrega: Grátis" : `Entrega: ${deliveryFee} Kz`;
    }

    // Montar o final items text que o themer ou admin vê
    const finalItemsText = `${generatedItemsTextParts.join(", ")} | ${deliveryMessage}`;

    // Gerar o ID dinamicamente
    const idResult = await client.query("SELECT 'MP-' || nextval('order_id_seq') AS order_id");
    const orderId = idResult.rows[0].order_id;

    const insertRes = await client.query(
      `INSERT INTO orders (id, customer_id, total, status)
       VALUES ($1, $2, $3, 'pendente')
       RETURNING *`,
      [orderId, customer_id, calculatedTotal]
    );

    for (const oi of orderItemsToInsert) {
       await client.query(
         `INSERT INTO order_items (order_id, product_id, variation, quantity, price) VALUES ($1, $2, $3, $4, $5)`,
         [orderId, oi.product_id, oi.variation || null, oi.qty, oi.price]
       );
    }

    await client.query("COMMIT");
    // Responde com os dados puros para o cliente poder gerar o WA chat string
    const createdOrder = insertRes.rows[0];
    createdOrder.items_text = finalItemsText; // Compatibility Inject
    res.status(201).json(createdOrder);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao criar encomenda no DB:", err.message);
    res.status(400).json({ error: "Falha a gerar a fatura. Tente novamente." });
  } finally {
    client.release();
  }
});

// PUT /api/orders/:id/status — Actualizar estado da encomenda
router.put("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Estado é obrigatório" });
    }
    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Encomenda não encontrada" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao actualizar estado:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;
