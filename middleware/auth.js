const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_move_key";

/**
 * Middleware para garantir que o utilizador está autenticado (tem um JWT válido).
 * Também valida session_version para garantir sessão única por conta.
 */
const requireAuth = async (req, res, next) => {
  let token = null;

  // Tenta obter o token pelos cookies (HttpOnly) primeiro
  if (req.cookies && req.cookies.move_auth_token) {
    token = req.cookies.move_auth_token;
  }
  
  // Analisa o header Authorization (Fallback)
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Acesso não autorizado. Token em falta." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // Ex: { id: 1, email: "user@ex.com", role: "customer", sv: 1 }

    // ── Validar session_version (sessão única) ──
    if (payload.sv != null) {
      const result = await pool.query(
        "SELECT session_version FROM customers WHERE id = $1",
        [payload.id]
      );
      if (result.rows.length > 0 && result.rows[0].session_version !== payload.sv) {
        return res.status(401).json({
          error: "A tua sessão foi terminada porque fizeste login noutro dispositivo.",
          code: "SESSION_EXPIRED"
        });
      }
    }

    next();
  } catch (err) {
    console.error("Erro na verificação do token:", err.message);
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
};

/**
 * Middleware para garantir que o utilizador tem permissões de administrador.
 * Deve ser usado APÓS o requireAuth ou internamente chamar a lógica, mas para 
 * simplificar o encadeamento nas rotas, fazemos a verificação do role aqui.
 */
const requireAdmin = (req, res, next) => {
  requireAuth(req, res, async () => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
      }
      
      // Verifica na base de dados (on server) se o utilizador ainda é admin
      const result = await pool.query(
        "SELECT role FROM customers WHERE id = $1",
        [req.user.id]
      );
      
      if (result.rows.length > 0 && result.rows[0].role === "admin") {
        next();
      } else {
        res.status(403).json({ error: "Acesso negado. Apenas administradores." });
      }
    } catch (err) {
      console.error("Erro ao verificar role de admin:", err.message);
      res.status(500).json({ error: "Erro interno na validação de permissões." });
    }
  });
};

/**
 * Middleware para garantir que o utilizador manipula os seus próprios dados.
 * Assume que o ID do recurso ou utilizador vem em req.params.id ou req.query.customerId.
 */
const requireOwnership = (req, res, next) => {
  requireAuth(req, res, async () => {
    try {
      const targetId = String(req.params.id || req.query.customerId || req.body.customerId);
      
      if (!req.user) {
        return res.status(403).json({ error: "Acesso negado. Ação não autorizada." });
      }

      if (String(req.user.id) === targetId) {
        // É o próprio utilizador
        return next();
      }

      // Se não for o próprio utilizador, verifica se é admin na BD
      const result = await pool.query(
        "SELECT role FROM customers WHERE id = $1",
        [req.user.id]
      );

      if (result.rows.length > 0 && result.rows[0].role === "admin") {
        return next();
      }

      res.status(403).json({ error: "Acesso negado. Ação não autorizada." });
    } catch (err) {
      console.error("Erro ao verificar ownership/admin:", err.message);
      res.status(500).json({ error: "Erro interno na validação de permissões." });
    }
  });
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireOwnership,
};
