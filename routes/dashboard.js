/* ============================================
   MOVE PLUS — Rotas do Dashboard
   ============================================ */

const router = require("express").Router();
const { pool } = require("../config/db");
const { requireAdmin } = require("../middleware/auth");

// GET /api/dashboard/stats — KPIs do Dashboard
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    // Data actual vs Data do mês anterior
    // Total de encomendas
    const ordersResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS total_orders_current,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE - interval '1 month') AND created_at < date_trunc('month', CURRENT_DATE))::int AS total_orders_previous
      FROM orders
    `);

    // Receita
    const revenueResult = await pool.query(`
      SELECT 
        COALESCE(SUM(total) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)), 0)::int AS revenue_current,
        COALESCE(SUM(total) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE - interval '1 month') AND created_at < date_trunc('month', CURRENT_DATE)), 0)::int AS revenue_previous
      FROM orders
      WHERE status != 'cancelado'
    `);

    // Clientes
    const customersResult = await pool.query(`
      SELECT 
        COUNT(*)::int AS total_customers_current,
        COUNT(*) FILTER (WHERE created_at < date_trunc('month', CURRENT_DATE))::int AS total_customers_previous
      FROM customers
    `);

    // Produtos sem stock
    const outOfStockResult = await pool.query(`
      SELECT COUNT(*)::int AS out_of_stock
      FROM products
      WHERE stock <= 0 OR stock IS NULL
    `);

    // Encomendas recentes (top 5)
    const recentOrders = await pool.query(`
      SELECT o.*, cu.name AS customer_name, cu.phone AS customer_phone
      FROM orders o
      LEFT JOIN customers cu ON o.customer_id = cu.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    // Top produtos (por stock mais baixo = mais vendidos)
    const topProducts = await pool.query(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'ativo'
      ORDER BY p.stock ASC
      LIMIT 5
    `);

    const calcPct = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const oData = ordersResult.rows[0];
    const rData = revenueResult.rows[0];
    const cData = customersResult.rows[0];

    res.json({
      total_orders: oData.total_orders_current,
      orders_pct: calcPct(oData.total_orders_current, oData.total_orders_previous),
      
      total_revenue: rData.revenue_current,
      revenue_pct: calcPct(rData.revenue_current, rData.revenue_previous),
      
      total_customers: cData.total_customers_current,
      customers_pct: calcPct(cData.total_customers_current, cData.total_customers_previous),
      
      out_of_stock: outOfStockResult.rows[0].out_of_stock,
      recent_orders: recentOrders.rows,
      top_products: topProducts.rows,
    });
  } catch (err) {
    console.error("Erro ao obter estatísticas:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

module.exports = router;
