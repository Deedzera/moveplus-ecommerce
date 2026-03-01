/* ============================================
   MOVE PLUS — Middleware de Upload (Multer + Cloudinary)
   ============================================ */

const multer  = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// ─── Tipos permitidos ──────────────────────
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp", "mp4"];
const MAX_SIZE_MB      = 10;

// ─── Storage: envia directamente para o Cloudinary ───
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Detectar resource_type (vídeo ou imagem)
    const isVideo     = file.mimetype.startsWith("video/");
    const resourceType = isVideo ? "video" : "image";

    return {
      folder:        "moveplus/products",
      resource_type: resourceType,
      allowed_formats: ALLOWED_FORMATS,
      // Transformações automáticas para imagens
      transformation: isVideo
        ? []
        : [{ width: 1200, height: 1200, crop: "limit", quality: "auto" }],
    };
  },
});

// ─── Filtro de tipo de ficheiro ────────────
function fileFilter(req, file, cb) {
  const ext  = file.originalname.split(".").pop().toLowerCase();
  const mime = file.mimetype;
  const valid =
    ALLOWED_FORMATS.includes(ext) &&
    (mime.startsWith("image/") || mime.startsWith("video/"));

  if (!valid) {
    return cb(
      new Error(
        `Tipo de ficheiro inválido. Aceites: ${ALLOWED_FORMATS.join(", ")}`
      ),
      false
    );
  }
  cb(null, true);
}

// ─── Instância do multer ───────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 }, // 10 MB em bytes
});

// ─── Middleware com tratamento de erros ───
function _wrapMulter(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ error: `Ficheiro muito grande. Máximo: ${MAX_SIZE_MB}MB` });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res
            .status(400)
            .json({ error: "Demasiados ficheiros. Máximo: 10 por produto." });
        }
        console.error("Erro do multer:", err.message);
        return res.status(400).json({ error: "Ocorreu um erro ao processar o upload do ficheiro." });
      }

      // Erros personalizados (tipo inválido, etc.)
      console.error("Erro personalizado no upload:", err.message);
      return res.status(400).json({ error: "Ocorreu um erro com o ficheiro. Verifica o formato e tenta novamente." });
    });
  };
}

// Upload de ficheiro único
function uploadSingle(fieldName) {
  return _wrapMulter(upload.single(fieldName));
}

// Upload de múltiplos ficheiros (máx. 10) no mesmo campo
function uploadArray(fieldName, maxCount = 10) {
  return _wrapMulter(upload.array(fieldName, maxCount));
}

// ─── Storage separado para imagens das settings (hero / login) ───
const settingsStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder:           "moveplus/settings",
      resource_type:    "image",
      allowed_formats:  ["jpg", "jpeg", "png", "webp"],
      transformation:   [{ width: 1920, height: 1080, crop: "limit", quality: "auto" }],
    };
  },
});

const settingsUpload = multer({
  storage: settingsStorage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

// Middleware para upload de imagens das settings (hero + login)
function uploadSettingsImages() {
  return _wrapMulter(
    settingsUpload.fields([
      { name: "hero_image",  maxCount: 1 },
      { name: "login_image", maxCount: 1 },
    ])
  );
}

module.exports = { uploadSingle, uploadArray, uploadSettingsImages };
