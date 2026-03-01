/* ============================================
   MOVE PLUS — Rotas de Clientes (Auth v3)
   ============================================
   Autenticação: Password (bcrypt) + OTP adaptativo
   OTP apenas exigido quando risk score >= 50
   ou dispositivo não é de confiança.
   ============================================ */

const router  = require("express").Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { pool } = require("../config/db");
const { requireAuth, requireAdmin, requireOwnership } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_move_key";
const { sendOTPEmail, sendPasswordResetOTPEmail } = require("../utils/mailer");
const {
  checkTrustedDevice,
  generateDeviceId,
  setTrustedCookie,
  clearTrustedCookie,
  getCountryFromIp,
  getClientIp,
} = require("../utils/trustedDevice");

// ─── Helpers ───────────────────────────────
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Devolve dados seguros do cliente (sem password_hash nem otp)
function safeCustomer(row) {
  const { password_hash, otp_code, otp_expires_at, ...safe } = row;
  return safe;
}

// ══════════════════════════════════════════
// GET /api/customers — Listar todos (admin)
// ══════════════════════════════════════════
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query, params = [];

    if (search) {
      params.push(`%${search}%`);
      query = `
        SELECT c.id, c.name, c.email, c.phone, c.role, c.is_verified,
               c.total_spent, c.member_since, c.created_at,
               COUNT(o.id)::int AS order_count
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        WHERE c.name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `;
    } else {
      query = `
        SELECT c.id, c.name, c.email, c.phone, c.role, c.is_verified,
               c.total_spent, c.member_since, c.created_at,
               COUNT(o.id)::int AS order_count
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar clientes:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// POST /api/customers — Registo
// ══════════════════════════════════════════
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // ── Validação básica ──────────────────
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Nome, email e palavra-passe são obrigatórios"
      });
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Endereço de email inválido" });
    }
    if (password.length < 8) {
      return res.status(400).json({
        error: "A palavra-passe deve ter pelo menos 8 caracteres"
      });
    }

    // ── Verificar duplicados (Email ou Telefone) ──
    if (phone) {
      const existing = await pool.query(
        "SELECT email, phone FROM customers WHERE email = $1 OR phone = $2",
        [email.toLowerCase(), phone]
      );
      if (existing.rows.length > 0) {
        const found = existing.rows[0];
        if (found.email === email.toLowerCase()) {
          return res.status(409).json({ error: "Já existe uma conta com este email" });
        }
        if (found.phone === phone) {
          return res.status(409).json({ error: "Este número de telefone já está associado a outra conta" });
        }
      }
    } else {
      const existing = await pool.query(
        "SELECT id FROM customers WHERE email = $1",
        [email.toLowerCase()]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "Já existe uma conta com este email" });
      }
    }

    // ── Hash da password ──────────────────
    const password_hash = await bcrypt.hash(password, 12);

    // ── Gerar OTP ─────────────────────────
    const otpCode      = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60000); // 15 min

    // ── Inserir cliente ───────────────────
    const insertQ = `
      INSERT INTO customers
        (name, email, phone, password_hash, is_verified, otp_code, otp_expires_at)
      VALUES ($1, $2, $3, $4, FALSE, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(insertQ, [
      name,
      email.toLowerCase(),
      phone || null,
      password_hash,
      otpCode,
      otpExpiresAt
    ]);

    const newCustomer = result.rows[0];

    // ── Enviar email com OTP ──────────────
    const mailResult = await sendOTPEmail(email, otpCode, name);
    if (!mailResult.success) {
      console.warn("Aviso: email OTP não enviado →", mailResult.error);
    }

    res.status(201).json({
      message: "Conta criada! Verifica o teu email para activar a conta.",
      customer: safeCustomer(newCustomer)
    });
  } catch (err) {
    // ── Fallback caso ocorra race condition ──
    if (err.constraint === 'customers_email_key' || (err.message && err.message.includes('customers_email_key'))) {
      return res.status(409).json({ error: "Já existe uma conta com este email" });
    }
    if (err.constraint === 'customers_phone_key' || (err.message && err.message.includes('customers_phone_key'))) {
      return res.status(409).json({ error: "Este número de telefone já está associado a outra conta" });
    }
    console.error("Erro ao criar cliente:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// POST /api/customers/login
// ══════════════════════════════════════════
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email e palavra-passe são obrigatórios"
      });
    }

    // ── Procurar cliente ──────────────────
    const result = await pool.query(
      "SELECT * FROM customers WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Email ou palavra-passe incorretos"
      });
    }

    const customer = result.rows[0];

    // ── Verificar password ────────────────
    if (!customer.password_hash) {
      return res.status(401).json({
        error: "Esta conta não tem palavra-passe definida. Contacta o suporte."
      });
    }

    const passwordMatch = await bcrypt.compare(password, customer.password_hash);

    if (!passwordMatch) {
      // Incrementar tentativas falhadas
      await pool.query(
        `UPDATE customers
         SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
             last_failed_at = NOW()
         WHERE id = $1`,
        [customer.id]
      );
      return res.status(401).json({
        error: "Email ou palavra-passe incorretos"
      });
    }

    // ── Resetar contador de falhas ────────
    await pool.query(
      "UPDATE customers SET failed_login_attempts = 0, last_failed_at = NULL WHERE id = $1",
      [customer.id]
    );

    // Recarregar customer com dados atualizados
    const freshResult = await pool.query(
      "SELECT * FROM customers WHERE id = $1",
      [customer.id]
    );
    const freshCustomer = freshResult.rows[0];

    // ── Verificar dispositivo de confiança ─
    const trustCheck = await checkTrustedDevice(req, customer.id, freshCustomer, pool);

    if (trustCheck.trusted) {
      // ✅ Dispositivo de confiança + risco baixo → login direto
      console.log(`[Login] userId=${customer.id} — dispositivo confiável, sem OTP`);

      // ── Incrementar session_version (invalida sessões anteriores) ──
      const svResult = await pool.query(
        "UPDATE customers SET session_version = COALESCE(session_version, 0) + 1 WHERE id = $1 RETURNING session_version",
        [freshCustomer.id]
      );
      const newSV = svResult.rows[0].session_version;

      const token = jwt.sign(
        { id: freshCustomer.id, email: freshCustomer.email, role: freshCustomer.role, sv: newSV },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.cookie("move_auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      res.cookie("is_logged_in", "1", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.json({
        message: "Login efectuado com sucesso.",
        loggedIn: true,
        requires_otp: false,
        customer: safeCustomer(freshCustomer)
      });
    }

    // ── Dispositivo não confiável → OTP ───
    console.log(`[Login] userId=${customer.id} — OTP exigido. Motivo: ${trustCheck.reason}`);

    const otpCode      = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60000);

    await pool.query(
      "UPDATE customers SET otp_code = $1, otp_expires_at = $2 WHERE id = $3",
      [otpCode, otpExpiresAt, customer.id]
    );

    const mailResult = await sendOTPEmail(email, otpCode, customer.name);
    if (!mailResult.success) {
      console.warn("Aviso: email OTP não enviado →", mailResult.error);
    }

    return res.json({
      message: "Palavra-passe correcta. Verifica o teu email para o código OTP.",
      requires_otp: true,
      email: customer.email,
      risk_reason: trustCheck.reason
    });
  } catch (err) {
    console.error("Erro no login:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// POST /api/customers/verify-otp
// ══════════════════════════════════════════
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email e OTP são obrigatórios" });
    }

    const result = await pool.query(
      "SELECT * FROM customers WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const customer = result.rows[0];

    if (!customer.otp_code) {
      return res.status(400).json({ error: "Não há nenhum código OTP pendente para esta conta" });
    }

    if (customer.otp_code !== otp.trim()) {
      return res.status(400).json({ error: "Código OTP incorreto" });
    }

    if (new Date(customer.otp_expires_at) < new Date()) {
      return res.status(400).json({ error: "O código OTP expirou. Solicita um novo." });
    }

    // ── Marcar como verificado, limpar OTP e incrementar session_version ──
    const updateQ = `
      UPDATE customers
      SET is_verified = TRUE, otp_code = NULL, otp_expires_at = NULL,
          session_version = COALESCE(session_version, 0) + 1
      WHERE id = $1
      RETURNING *
    `;
    const updated = await pool.query(updateQ, [customer.id]);
    const finalCustomer = updated.rows[0];

    const token = jwt.sign(
      { id: finalCustomer.id, email: finalCustomer.email, role: finalCustomer.role, sv: finalCustomer.session_version },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("move_auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    res.cookie("is_logged_in", "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: "Verificação concluída com sucesso!",
      customer: safeCustomer(finalCustomer),
      otp_passed: true   // frontend usa esta flag para mostrar opção de confiar dispositivo
    });
  } catch (err) {
    console.error("Erro na verificação de OTP:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// POST /api/customers/resend-otp
// ══════════════════════════════════════════
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    const result = await pool.query(
      "SELECT * FROM customers WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const customer = result.rows[0];

    // ── Rate limit simples: esperar 60 s antes de reenviar ──
    if (customer.otp_expires_at) {
      const originalSentAt = new Date(customer.otp_expires_at).getTime() - 15 * 60000;
      const secondsSinceSent = (Date.now() - originalSentAt) / 1000;
      if (secondsSinceSent < 60) {
        return res.status(429).json({
          error: `Aguarda ${Math.ceil(60 - secondsSinceSent)} segundos antes de reenviar.`
        });
      }
    }

    const newOtp       = generateOTP();
    const newExpiresAt = new Date(Date.now() + 15 * 60000);

    await pool.query(
      "UPDATE customers SET otp_code = $1, otp_expires_at = $2 WHERE id = $3",
      [newOtp, newExpiresAt, customer.id]
    );

    const mailResult = await sendOTPEmail(email, newOtp, customer.name);
    if (!mailResult.success) {
      return res.status(500).json({ error: "Não foi possível enviar o email. Tenta novamente." });
    }

    res.json({ message: "Novo código enviado com sucesso!" });
  } catch (err) {
    console.error("Erro ao reenviar OTP:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// POST /api/customers/trust-device
// Chamado após OTP verificado com sucesso
// Body: { email }
// ══════════════════════════════════════════
router.post("/trust-device", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM customers WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const customer = result.rows[0];

    // Segurança: só pode confiar dispositivo se conta está verificada
    // e o OTP foi recentemente limpo (otp_code é NULL = passou OTP)
    if (!customer.is_verified) {
      return res.status(403).json({
        error: "Conta não verificada. Completa o OTP primeiro."
      });
    }

    const userAgent  = req.headers["user-agent"] || "";
    const clientIp   = getClientIp(req);
    const country    = getCountryFromIp(clientIp);
    const deviceId   = generateDeviceId(customer.id, userAgent);
    const expiresAt  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    // Upsert: se já existe este device_id para o user, actualizar; senão inserir
    await pool.query(
      `INSERT INTO trusted_devices
         (user_id, device_id, ip_address, country, user_agent, expires_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT DO NOTHING`,
      [customer.id, deviceId, clientIp, country, userAgent, expiresAt]
    );

    // Definir cookie HttpOnly assinado
    setTrustedCookie(res, deviceId, customer.id);

    res.json({
      message: "Dispositivo marcado como confiável por 30 dias.",
      expires_at: expiresAt
    });
  } catch (err) {
    console.error("Erro ao marcar dispositivo:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// GET /api/customers/trusted-devices
// Listar dispositivos de confiança do utilizador logado
// ══════════════════════════════════════════
router.get("/trusted-devices", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, country, ip_address, user_agent, created_at, last_used_at, expires_at
       FROM trusted_devices
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_used_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar dispositivos:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// DELETE /api/customers/trusted-devices/:id
// Revogar um dispositivo de confiança
// ══════════════════════════════════════════
router.delete("/trusted-devices/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM trusted_devices WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Dispositivo não encontrado" });
    }

    // Limpar cookie se o utilizador revogou o próprio dispositivo atual
    clearTrustedCookie(res);

    res.json({ message: "Dispositivo removido com sucesso." });
  } catch (err) {
    console.error("Erro ao revogar dispositivo:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// GET /api/customers/me — Obter os meus dados (via JWT)
// ══════════════════════════════════════════
router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, is_verified,
              total_spent, member_since, created_at
       FROM customers WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao obter cliente atual:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// GET /api/customers/:id — Obter por ID
// ══════════════════════════════════════════
router.get("/:id", requireOwnership, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, is_verified,
              total_spent, member_since, created_at
       FROM customers WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao obter cliente:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// DELETE /api/customers/:id — Eliminar
// ══════════════════════════════════════════
router.delete("/:id", requireOwnership, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM customers WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.json({ message: "Cliente eliminado com sucesso" });
  } catch (err) {
    console.error("Erro ao eliminar cliente:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// GET /api/customers/:id/addresses
// ══════════════════════════════════════════
router.get("/:id/addresses", requireOwnership, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC",
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao obter endereços:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// POST /api/customers/:id/addresses
// ══════════════════════════════════════════
router.post("/:id/addresses", requireOwnership, async (req, res) => {
  try {
    const { address, city, district, is_default } = req.body;
    if (!address || !city || !district) {
      return res.status(400).json({ error: "Morada, cidade e município são obrigatórios" });
    }

    if (is_default) {
      await pool.query(
        "UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1",
        [req.params.id]
      );
    }

    const countResult = await pool.query(
      "SELECT COUNT(*) FROM customer_addresses WHERE customer_id = $1",
      [req.params.id]
    );
    const isFirst     = parseInt(countResult.rows[0].count) === 0;
    const makeDefault = isFirst || is_default || false;

    const result = await pool.query(
      "INSERT INTO customer_addresses (customer_id, address, city, district, is_default) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.params.id, address, city, district, makeDefault]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao adicionar endereço:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// DELETE /api/customers/:id/addresses/:addressId
// ══════════════════════════════════════════
router.delete("/:id/addresses/:addressId", requireOwnership, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2 RETURNING *",
      [req.params.addressId, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Endereço não encontrado" });
    }

    if (result.rows[0].is_default) {
      const remaining = await pool.query(
        "SELECT id FROM customer_addresses WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1",
        [req.params.id]
      );
      if (remaining.rows.length > 0) {
        await pool.query(
          "UPDATE customer_addresses SET is_default = TRUE WHERE id = $1",
          [remaining.rows[0].id]
        );
      }
    }

    res.json({ message: "Endereço removido com sucesso" });
  } catch (err) {
    console.error("Erro ao remover endereço:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// POST /api/customers/forgot-password
// Pedido de recuperação de senha
// ══════════════════════════════════════════
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    const result = await pool.query(
      "SELECT * FROM customers WHERE email = $1",
      [email.toLowerCase()]
    );

    // Por razões de segurança, não revelamos se o email existe ou não
    if (result.rows.length === 0) {
      return res.json({ message: "Se o email estiver registado, irás receber um código de recuperação." });
    }

    const customer = result.rows[0];

    // Gerar OTP
    const otpCode = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60000); // 15 minutos

    await pool.query(
      "UPDATE customers SET otp_code = $1, otp_expires_at = $2 WHERE id = $3",
      [otpCode, otpExpiresAt, customer.id]
    );

    const mailResult = await sendPasswordResetOTPEmail(email, otpCode, customer.name);
    if (!mailResult.success) {
      console.warn("Aviso: email de recuperação não enviado →", mailResult.error);
    }

    res.json({ message: "Se o email estiver registado, irás receber um código de recuperação." });
  } catch (err) {
    console.error("Erro na recuperação de senha:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// POST /api/customers/reset-password
// Repor a senha usando OTP
// ══════════════════════════════════════════
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, código OTP e nova palavra-passe são obrigatórios" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "A palavra-passe deve ter pelo menos 8 caracteres" });
    }

    const result = await pool.query(
      "SELECT * FROM customers WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Dados inválidos." });
    }

    const customer = result.rows[0];

    if (!customer.otp_code || customer.otp_code !== otp.trim()) {
      return res.status(400).json({ error: "Código OTP inválido." });
    }

    if (new Date(customer.otp_expires_at) < new Date()) {
      return res.status(400).json({ error: "O código OTP expirou." });
    }

    // Hash da nova password
    const password_hash = await bcrypt.hash(newPassword, 12);

    // Atualizar password e limpar tokens/sessões
    await pool.query(
      `UPDATE customers
       SET password_hash = $1,
           otp_code = NULL,
           otp_expires_at = NULL,
           session_version = COALESCE(session_version, 0) + 1,
           failed_login_attempts = 0,
           last_failed_at = NULL
       WHERE id = $2`,
      [password_hash, customer.id]
    );

    res.json({ message: "Palavra-passe alterada com sucesso! Já podes iniciar sessão." });
  } catch (err) {
    console.error("Erro ao repor senha:", err.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ══════════════════════════════════════════
// POST /api/customers/logout
// Terminar Sessão
// ══════════════════════════════════════════
router.post("/logout", (req, res) => {
  res.clearCookie("move_auth_token", { sameSite: "strict" });
  res.clearCookie("is_logged_in", { sameSite: "strict" });
  res.json({ message: "Sessão terminada com sucesso." });
});

module.exports = router;
