/* ============================================
   MOVE PLUS — Middleware de Upload (Multer + Cloudinary)
   ============================================ */

const streamifier = require("streamifier");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");

// ─── Tipos permitidos ──────────────────────
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp", "mp4"];
const MAX_SIZE_MB = 10;

// ─── Filtro de tipo de ficheiro ────────────
function fileFilter(req, file, cb) {
  const mime = file.mimetype;
  const valid = mime.startsWith("image/") || mime.startsWith("video/");

  if (!valid) {
    return cb(
      new Error(`Tipo de ficheiro inválido. Aceites: Imagens e Vídeos`),
      false
    );
  }
  cb(null, true);
}

// ─── Instância do multer COM MEMÓRIA (Vercel Fix) ───
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 }, // 10 MB
});

// ─── Helper de Upload para Cloudinary ───
const uploadBufferToCloudinary = (buffer, folder, isVideo = false) => {
  return new Promise((resolve, reject) => {
    let uploadOptions = {
      folder: folder,
      resource_type: isVideo ? "video" : "image",
    };
    if (!isVideo) {
      uploadOptions.transformation = [
        { width: 1200, height: 1200, crop: "limit", quality: "auto" },
      ];
    }
    const cld_upload_stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("Cloudinary Stream Error:", error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(cld_upload_stream);
  });
};

const uploadBufferForSettingsCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const cld_upload_stream = cloudinary.uploader.upload_stream(
      {
        folder: "moveplus/settings",
        resource_type: "image",
        transformation: [
          { width: 1920, height: 1080, crop: "limit", quality: "auto" },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(cld_upload_stream);
  });
};

// ─── Wrapper Multer + Cloudinary ───
function uploadSingle(fieldName) {
  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
      if (err) return handleMulterError(err, res);
      if (!req.file) return next();

      try {
        const isVideo = req.file.mimetype.startsWith("video/");
        const result = await uploadBufferToCloudinary(
          req.file.buffer,
          "moveplus/products",
          isVideo
        );
        req.file.path = result.secure_url; // Simulando comportamento do storage original
        next();
      } catch (uploadError) {
        console.error("Cloudinary Single Error:", uploadError);
        return res
          .status(500)
          .json({ error: "Erro ao fazer upload para o Cloudinary: " + (uploadError.message || JSON.stringify(uploadError)) });
      }
    });
  };
}

function uploadArray(fieldName, maxCount = 10) {
  return async (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) return handleMulterError(err, res);
      if (!req.files || req.files.length === 0) return next();

      try {
        const uploadPromises = req.files.map((file) => {
          const isVideo = file.mimetype.startsWith("video/");
          return uploadBufferToCloudinary(
            file.buffer,
            "moveplus/products",
            isVideo
          ).then((result) => {
            file.path = result.secure_url;
          });
        });
        await Promise.all(uploadPromises);
        next();
      } catch (uploadError) {
        console.error("Cloudinary Array Error:", uploadError);
        return res
          .status(500)
          .json({ error: "Erro ao transferir ficheiros para o Cloudinary: " + (uploadError.message || JSON.stringify(uploadError)) });
      }
    });
  };
}

function uploadSettingsImages() {
  return async (req, res, next) => {
    upload.fields([
      { name: "hero_image", maxCount: 1 },
      { name: "login_image", maxCount: 1 },
    ])(req, res, async (err) => {
      if (err) return handleMulterError(err, res);

      try {
        if (req.files) {
          if (req.files["hero_image"] && req.files["hero_image"][0]) {
            const result = await uploadBufferForSettingsCloudinary(
              req.files["hero_image"][0].buffer
            );
            req.files["hero_image"][0].path = result.secure_url;
          }
          if (req.files["login_image"] && req.files["login_image"][0]) {
            const result = await uploadBufferForSettingsCloudinary(
              req.files["login_image"][0].buffer
            );
            req.files["login_image"][0].path = result.secure_url;
          }
        }
        next();
      } catch (uploadError) {
        console.error("Cloudinary Settings Error:", uploadError);
        return res
          .status(500)
          .json({ error: "Erro ao transferir imagens para o Cloudinary: " + (uploadError.message || JSON.stringify(uploadError)) });
      }
    });
  };
}

function handleMulterError(err, res) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: `Ficheiro gigante. Máximo: ${MAX_SIZE_MB}MB` });
    }
    return res
      .status(400)
      .json({ error: "Ocorreu um erro ao processar o ficheiro." });
  }
  return res.status(400).json({
    error: "Ocorreu um erro. Verifica o formato e tenta novamente.",
  });
}

module.exports = { uploadSingle, uploadArray, uploadSettingsImages };
