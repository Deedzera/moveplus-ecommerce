-- ============================================
--  MOVE PLUS — Inicialização da Base de Dados
-- ============================================

-- Criar base de dados (executar à parte se necessário)
-- CREATE DATABASE moveplus;

-- Ligar à base de dados moveplus antes de executar o resto

-- ===== DROP (ordem inversa de dependências) =====
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS trusted_devices CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP SEQUENCE IF EXISTS order_id_seq CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- ===== CATEGORIAS =====
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    icon        VARCHAR(100) DEFAULT '',
    image_url   TEXT DEFAULT '',
    size_type   VARCHAR(50) DEFAULT 'none',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== PRODUTOS =====
CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(300) UNIQUE NOT NULL,
    category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    price           INTEGER NOT NULL DEFAULT 0,
    old_price       INTEGER,
    stock           INTEGER DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'ativo',
    tag             VARCHAR(30) DEFAULT '',
    description     TEXT DEFAULT '',
    available_sizes TEXT DEFAULT '',
    gender          VARCHAR(20) DEFAULT 'unissexo',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_images (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    is_primary  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== CLIENTES =====
CREATE TABLE customers (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(255) NOT NULL,
    phone                   VARCHAR(50) UNIQUE,
    email                   VARCHAR(255) UNIQUE,
    password_hash           TEXT,
    total_spent             INTEGER DEFAULT 0,
    member_since            VARCHAR(10),
    role                    VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    otp_code                VARCHAR(10),
    otp_expires_at          TIMESTAMP,
    is_verified             BOOLEAN DEFAULT FALSE,
    failed_login_attempts   INTEGER DEFAULT 0,
    last_failed_at          TIMESTAMP,
    session_version         INTEGER DEFAULT 1,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_addresses (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    address     VARCHAR(255) NOT NULL,
    city        VARCHAR(100) NOT NULL,
    district    VARCHAR(100) NOT NULL,
    is_default  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== ENCOMENDAS =====
CREATE SEQUENCE order_id_seq START 2401;

CREATE TABLE orders (
    id          VARCHAR(20) PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    total       INTEGER DEFAULT 0,
    status      VARCHAR(30) DEFAULT 'pendente',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id          SERIAL PRIMARY KEY,
    order_id    VARCHAR(20) REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
    variation   VARCHAR(100),
    quantity    INTEGER NOT NULL DEFAULT 1,
    price       INTEGER NOT NULL DEFAULT 0
);

-- ===== MENSAGENS =====
CREATE TABLE messages (
    id             SERIAL PRIMARY KEY,
    customer_name  VARCHAR(255) NOT NULL,
    phone          VARCHAR(50),
    text           TEXT NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== DISPOSITIVOS DE CONFIANÇA =====
CREATE TABLE trusted_devices (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    device_id     VARCHAR(128) NOT NULL,
    ip_address    VARCHAR(45),
    country       VARCHAR(10) DEFAULT 'XX',
    user_agent    TEXT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at    TIMESTAMP NOT NULL
);
CREATE INDEX idx_trusted_devices_user   ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_device ON trusted_devices(device_id);

-- ===== SETTINGS =====
CREATE TABLE settings (
    id                      INT PRIMARY KEY CHECK (id = 1),
    shop_name               VARCHAR(255)  DEFAULT 'Move Plus',
    shop_slogan             TEXT          DEFAULT 'A tua loja online de confiança. Perfumes, cremes, roupa e acessórios — tudo ao melhor preço com entrega rápida.',
    shop_email              VARCHAR(255)  DEFAULT 'info@moveplus.ao',
    shop_whatsapp           VARCHAR(50)   DEFAULT '+244 999 999 999',
    shop_location           VARCHAR(255)  DEFAULT 'Luanda, Angola',
    social_instagram        VARCHAR(255)  DEFAULT '#',
    social_facebook         VARCHAR(255)  DEFAULT '#',
    social_tiktok           VARCHAR(255)  DEFAULT '#',
    primary_color           VARCHAR(50)   DEFAULT '#b8860b',
    delivery_fee            INTEGER       DEFAULT 500,
    free_delivery_threshold INTEGER       DEFAULT 10000,
    delivery_time           VARCHAR(100)  DEFAULT '24-48 horas',
    hero_image_url          TEXT,
    login_image_url         TEXT
);

-- Inserir linha global de settings
INSERT INTO settings (id) VALUES (1);

-- ===== FAVORITOS =====
CREATE TABLE favorites (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, product_id)
);
CREATE INDEX idx_fav_customer ON favorites(customer_id);

-- ============================================
--  DADOS DE EXEMPLO (opcional)
-- ============================================

-- Categorias
