/* ============================================
   MOVE PLUS — Controller de Produtos
   ============================================ */

const { pool } = require("../config/db");

/* --------------------------------------------------
   Utilitário: gera slug a partir de um nome
   "Camisa Preta XL" → "camisa-preta-xl"
-------------------------------------------------- */
function generateSlug(name) {
  const accents =
    "ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ";
  const plain =
    "AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn";
  let str = name;
  for (let i = 0; i < accents.length; i++) {
    str = str.replaceAll(accents[i], plain[i]);
  }
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Garante slug único — se já existir, adiciona sufixo numérico.
 * @param {string} baseSlug  slug base (ex: "camisa-preta")
 * @param {number|null} excludeId  ID do produto a excluir da verificação (para updates)
 */
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const check = excludeId
      ? await pool.query("SELECT id FROM products WHERE slug = $1 AND id != $2", [slug, excludeId])
      : await pool.query("SELECT id FROM products WHERE slug = $1", [slug]);
    if (check.rows.length === 0) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/* --------------------------------------------------
   POST /admin/produtos
   Cria um produto e associa a imagem enviada para o
   Cloudinary (req.file injectado pelo middleware).
-------------------------------------------------- */
async function createProduct(req, res) {
  try {
    const {
      name,
      category_id,
      price,
      old_price,
      stock,
      status,
      tag,
      description,
      available_sizes,
      gender,
    } = req.body;

    // URLs das imagens enviadas para o Cloudinary
    // req.files é preenchido pelo uploadArray; req.file pelo uploadSingle
    const files = req.files && req.files.length ? req.files : (req.file ? [req.file] : []);
    const uploadedImages = files.map((f) => f.path);

    // Validação mínima
    if (!name || !price) {
      return res
        .status(400)
        .json({ error: "Os campos 'name' e 'price' são obrigatórios." });
    }

    // Validação de Tipos Numéricos
    const parsedPrice = parseInt(price);
    if (isNaN(parsedPrice)) {
      return res.status(400).json({ error: "O preço deve ser um valor numérico válido." });
    }

    let parsedOldPrice = null;
    if (old_price) {
      parsedOldPrice = parseInt(old_price);
      if (isNaN(parsedOldPrice)) return res.status(400).json({ error: "O preço antigo deve ser numérico." });
    }

    let parsedStock = 0;
    if (stock) {
      parsedStock = parseInt(stock);
      if (isNaN(parsedStock)) return res.status(400).json({ error: "O stock deve ser um valor numérico válido." });
    }

    // Gerar slug único a partir do nome
    const slug = await ensureUniqueSlug(generateSlug(name));

    const result = await pool.query(
      `INSERT INTO products
         (name, slug, category_id, price, old_price, stock, status, tag, description, available_sizes, gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        name,
        slug,
        category_id   || null,
        parsedPrice,
        parsedOldPrice,
        parsedStock,
        status        || "ativo",
        tag           || "",
        description   || "",
        available_sizes || "",
        gender        || "unissexo",
      ]
    );

    const productId = result.rows[0].id;

    for (const [idx, url] of uploadedImages.entries()) {
      await pool.query(
        "INSERT INTO product_images (product_id, image_url, is_primary) VALUES ($1, $2, $3)",
        [productId, url.trim(), idx === 0]
      );
    }

    const createdProduct = result.rows[0];
    createdProduct.image_url = uploadedImages.join(',');

    return res.status(201).json({
      message: "Produto criado com sucesso.",
      produto: createdProduct,
    });
  } catch (err) {
    console.error("❌  Erro ao criar produto:", err.message);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
}

/* --------------------------------------------------
   PUT /admin/produtos/:id
   Actualiza um produto existente.
   Se for enviado um novo ficheiro, a image_url é
   substituída; caso contrário mantém a anterior.
-------------------------------------------------- */
async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      category_id,
      price,
      old_price,
      stock,
      status,
      tag,
      description,
      existing_image_url,
      available_sizes,
      gender,
    } = req.body;

    // Validação de Tipos Numéricos
    const parsedPrice = parseInt(price);
    if (isNaN(parsedPrice)) {
      return res.status(400).json({ error: "O preço deve ser um valor numérico válido." });
    }

    let parsedOldPrice = null;
    if (old_price) {
      parsedOldPrice = parseInt(old_price);
      if (isNaN(parsedOldPrice)) return res.status(400).json({ error: "O preço antigo deve ser numérico." });
    }

    let parsedStock = 0;
    if (stock) {
      parsedStock = parseInt(stock);
      if (isNaN(parsedStock)) return res.status(400).json({ error: "O stock deve ser numérico." });
    }

    // Sync images to child table
    const files = req.files && req.files.length ? req.files : (req.file ? [req.file] : []);
    
    const finalImageUrls = [];
    if (existing_image_url) {
       finalImageUrls.push(...existing_image_url.split(',').map(s => s.trim()).filter(Boolean));
    }
    if (files.length > 0) {
       finalImageUrls.push(...files.map(f => f.path));
    }

    // Re-gerar slug se o nome mudou
    const slug = await ensureUniqueSlug(generateSlug(name), parseInt(id));

    const result = await pool.query(
      `UPDATE products
         SET name = $1, slug = $2, category_id = $3, price = $4, old_price = $5,
             stock = $6, status = $7, tag = $8, description = $9,
             available_sizes = $10, gender = $11
       WHERE id = $12
       RETURNING *`,
      [
        name,
        slug,
        category_id   || null,
        parsedPrice,
        parsedOldPrice,
        parsedStock,
        status        || "ativo",
        tag           || "",
        description   || "",
        available_sizes || "",
        gender        || "unissexo",
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado." });
    }

    await pool.query("DELETE FROM product_images WHERE product_id = $1", [id]);
    for (const [idx, url] of finalImageUrls.entries()) {
       await pool.query(
         "INSERT INTO product_images (product_id, image_url, is_primary) VALUES ($1, $2, $3)",
         [id, url.trim(), idx === 0]
       );
    }

    const updatedProduct = result.rows[0];
    updatedProduct.image_url = finalImageUrls.join(',');

    return res.json({
      message: "Produto actualizado com sucesso.",
      produto: updatedProduct,
    });
  } catch (err) {
    console.error("❌  Erro ao actualizar produto:", err.message);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
}

module.exports = { createProduct, updateProduct };
