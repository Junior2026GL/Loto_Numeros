-- ============================================================================
-- LOTO NÚMEROS · Script completo de base de datos (MySQL 8+)
--
-- Crea la base, todas las tablas, la vista de estadísticas, los datos
-- iniciales (roles, juego, configuración, historial 2026 y Super Admin).
--
-- Es seguro ejecutarlo más de una vez: no borra nada y no duplica datos.
-- Ejecución:  mysql -u root -p < setup.sql      (o abrirlo en MySQL Workbench)
--
-- IMPORTANTE: después de este script ejecuta  npm run migrate  (en la carpeta backend).
-- Este archivo es la base inicial; los cambios posteriores (contraseñas temporales, sesiones,
-- recuperación por correo...) están en la carpeta migrations/.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS loto_numeros
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE loto_numeros;

-- ----------------------------------------------------------------------------
-- 1. ACCESO: roles y usuarios
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(50)  NOT NULL UNIQUE,
  descripcion VARCHAR(255) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rol_id           BIGINT UNSIGNED NULL,
  nombre           VARCHAR(150) NOT NULL,
  usuario          VARCHAR(60)  NOT NULL UNIQUE,
  email            VARCHAR(180) NULL,
  telefono         VARCHAR(30)  NULL,
  password_hash    VARCHAR(255) NOT NULL,
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  ultimo_acceso_at DATETIME     NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. AUDITORÍA (bitácora de acciones sensibles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  BIGINT UNSIGNED NULL,
  accion      VARCHAR(100) NOT NULL,
  modulo      VARCHAR(100) NOT NULL,
  descripcion TEXT NULL,
  ip          VARCHAR(64) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auditoria_fecha  (created_at),
  INDEX idx_auditoria_modulo (modulo),
  INDEX idx_auditoria_accion (accion),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. CONFIGURACIÓN (clave / valor, editable desde el sistema)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion (
  clave      VARCHAR(80)  PRIMARY KEY,
  valor      VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. JUEGOS (permite soportar más de una lotería, no solo SuperPremio)
--    dias_sorteo usa números de día: 0=domingo, 1=lunes ... 3=miércoles ... 6=sábado
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS juegos (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo           VARCHAR(40)  NOT NULL UNIQUE,
  nombre           VARCHAR(120) NOT NULL,
  cantidad_numeros TINYINT UNSIGNED NOT NULL,
  numero_min       TINYINT UNSIGNED NOT NULL,
  numero_max       TINYINT UNSIGNED NOT NULL,
  dias_sorteo      VARCHAR(20)  NOT NULL,
  hora_sorteo      TIME         NOT NULL DEFAULT '21:00:00',
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_juego_rango CHECK (numero_min < numero_max AND cantidad_numeros <= (numero_max - numero_min + 1))
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. SORTEOS y sus números (normalizado: una fila por número sorteado)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sorteos (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  juego_id    BIGINT UNSIGNED NOT NULL,
  fecha       DATE NOT NULL,
  -- 0=domingo ... 3=miércoles ... 6=sábado (se calcula sola desde la fecha)
  dia_semana  TINYINT UNSIGNED GENERATED ALWAYS AS (DAYOFWEEK(fecha) - 1) STORED,
  fuente      ENUM('IMPORTACION','MANUAL','SCRAPER') NOT NULL DEFAULT 'MANUAL',
  creado_por  BIGINT UNSIGNED NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sorteo_juego_fecha (juego_id, fecha),
  INDEX idx_sorteo_fecha (fecha),
  INDEX idx_sorteo_dia (dia_semana),
  CONSTRAINT fk_sorteo_juego   FOREIGN KEY (juego_id)   REFERENCES juegos(id),
  CONSTRAINT fk_sorteo_usuario FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sorteo_numeros (
  sorteo_id BIGINT UNSIGNED NOT NULL,
  posicion  TINYINT UNSIGNED NOT NULL,
  numero    TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (sorteo_id, posicion),
  UNIQUE KEY uq_sorteo_numero (sorteo_id, numero),   -- un número no se repite en el mismo sorteo
  INDEX idx_numero (numero),
  CONSTRAINT fk_sn_sorteo FOREIGN KEY (sorteo_id) REFERENCES sorteos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. COMBINACIONES generadas por los usuarios (para compararlas luego con el resultado)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS combinaciones (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id            BIGINT UNSIGNED NOT NULL,
  juego_id              BIGINT UNSIGNED NOT NULL,
  estrategia            VARCHAR(40) NOT NULL,          -- SCORE, CALIENTES, ATRASADOS, PARES, BALANCEADA, ALEATORIA, MANUAL
  numeros               JSON NOT NULL,                 -- ej. [4,17,18,20,28,33]
  fecha_sorteo_objetivo DATE NULL,                     -- sorteo para el que se juega
  jugada                TINYINT(1) NOT NULL DEFAULT 0, -- 1 = el usuario la marcó como jugada
  aciertos              TINYINT UNSIGNED NULL,         -- se llena al evaluarla contra el resultado
  evaluada_at           DATETIME NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comb_usuario (usuario_id, created_at),
  INDEX idx_comb_objetivo (fecha_sorteo_objetivo),
  CONSTRAINT fk_comb_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_comb_juego   FOREIGN KEY (juego_id)   REFERENCES juegos(id)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. SINCRONIZACIONES con la fuente de resultados (loto.hn)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sincronizaciones (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  juego_id      BIGINT UNSIGNED NOT NULL,
  usuario_id    BIGINT UNSIGNED NULL,                  -- NULL cuando la ejecuta la tarea programada
  origen        ENUM('MANUAL','PROGRAMADA') NOT NULL DEFAULT 'MANUAL',
  fecha_desde   DATE NOT NULL,
  fecha_hasta   DATE NOT NULL,
  total_fechas  INT UNSIGNED NOT NULL DEFAULT 0,
  insertados    INT UNSIGNED NOT NULL DEFAULT 0,
  omitidos      INT UNSIGNED NOT NULL DEFAULT 0,
  errores       INT UNSIGNED NOT NULL DEFAULT 0,
  estado        ENUM('EN_CURSO','COMPLETADA','FALLIDA') NOT NULL DEFAULT 'EN_CURSO',
  detalle       TEXT NULL,
  iniciada_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finalizada_at DATETIME NULL,
  INDEX idx_sync_fecha (iniciada_at),
  CONSTRAINT fk_sync_juego   FOREIGN KEY (juego_id)   REFERENCES juegos(id),
  CONSTRAINT fk_sync_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. VISTA de frecuencia por número (base de las estadísticas)
--    Los números que nunca han salido no aparecen: el sistema los completa con 0.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_frecuencia_numeros AS
SELECT s.juego_id,
       sn.numero,
       COUNT(*)     AS veces,
       MAX(s.fecha) AS ultima_fecha
FROM sorteo_numeros sn
JOIN sorteos s ON s.id = sn.sorteo_id
GROUP BY s.juego_id, sn.numero;

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Roles
INSERT IGNORE INTO roles (id, nombre, descripcion) VALUES
(1, 'SUPER_ADMIN', 'Control total del sistema'),
(2, 'ADMIN',       'Administra sorteos, sincronización y estadísticas'),
(3, 'NORMAL',      'Consulta resultados y genera combinaciones');

-- Juego: Loto SuperPremio Honduras (6 números del 1 al 33, miércoles y sábado 9 PM)
INSERT IGNORE INTO juegos (id, codigo, nombre, cantidad_numeros, numero_min, numero_max, dias_sorteo, hora_sorteo) VALUES
(1, 'SUPERPREMIO', 'Loto SuperPremio Honduras', 6, 1, 33, '3,6', '21:00:00');

-- Configuración de las estadísticas
INSERT IGNORE INTO configuracion (clave, valor) VALUES
('zona_horaria',        'America/Tegucigalpa'),
('ventana_calientes',   '5'),    -- cuántos sorteos recientes cuentan como "calientes"
('peso_frecuencia',     '50'),   -- score compuesto: % frecuencia
('peso_atraso',         '35'),   -- score compuesto: % atraso
('peso_caliente',       '15');   -- score compuesto: % calientes

-- Super Admin inicial.
-- La contraseña inicial se te entregó por separado: cámbiala en el primer ingreso.
INSERT IGNORE INTO usuarios (rol_id, nombre, usuario, password_hash, activo) VALUES
(1, 'Super Administrador', 'superadmin',
 '$2a$12$G9XSMiUIYlWK8bTxmj.mPOLu7vjdjA5SZflmfnE6SgJ3YobL9vr.6', 1);

-- Historial 2026 (extraído de loto.hn). Se carga por una tabla temporal y se reparte
-- en sorteos + sorteo_numeros; INSERT IGNORE evita duplicados si se vuelve a ejecutar.
-- (tabla normal y no TEMPORARY: MySQL no permite usar una temporal varias veces en una consulta)
DROP TABLE IF EXISTS tmp_historial;
CREATE TABLE tmp_historial (
  fecha DATE PRIMARY KEY,
  n1 TINYINT UNSIGNED, n2 TINYINT UNSIGNED, n3 TINYINT UNSIGNED,
  n4 TINYINT UNSIGNED, n5 TINYINT UNSIGNED, n6 TINYINT UNSIGNED
);

INSERT INTO tmp_historial (fecha, n1, n2, n3, n4, n5, n6) VALUES
('2026-05-02',  4, 17, 18, 20, 28, 33),
('2026-05-06',  5,  7,  8, 18, 20, 26),
('2026-05-09',  1,  7,  9, 14, 30, 33),
('2026-05-13', 10, 14, 15, 19, 31, 32),
('2026-05-16',  7, 10, 12, 19, 21, 23),
('2026-05-20',  2,  9, 14, 19, 20, 26),
('2026-05-23',  5,  6,  9, 17, 24, 29),
('2026-05-27',  1,  9, 13, 14, 27, 31),
('2026-05-30',  4,  6,  7,  9, 13, 26),
('2026-06-03',  1, 16, 29, 30, 32, 33),
('2026-06-06',  5, 11, 12, 21, 30, 33),
('2026-06-10',  3,  6,  8, 10, 12, 13),
('2026-06-13',  1, 10, 12, 18, 30, 31),
('2026-06-17',  5, 11, 17, 24, 30, 31),
('2026-06-20',  2, 11, 14, 23, 25, 29),
('2026-06-24',  8, 10, 11, 13, 17, 32),
('2026-06-27',  6, 11, 14, 19, 23, 26),
('2026-07-01',  1,  4,  6, 18, 19, 20),
('2026-07-04',  4,  5, 11, 15, 20, 33),
('2026-07-08',  6,  8, 13, 17, 24, 26),
('2026-07-11',  1,  4, 13, 19, 21, 33),
('2026-07-15',  8, 11, 15, 18, 19, 29);

INSERT IGNORE INTO sorteos (juego_id, fecha, fuente)
SELECT 1, fecha, 'IMPORTACION' FROM tmp_historial;

INSERT IGNORE INTO sorteo_numeros (sorteo_id, posicion, numero)
SELECT s.id, p.posicion, p.numero
FROM (
  SELECT fecha, 1 AS posicion, n1 AS numero FROM tmp_historial UNION ALL
  SELECT fecha, 2, n2 FROM tmp_historial UNION ALL
  SELECT fecha, 3, n3 FROM tmp_historial UNION ALL
  SELECT fecha, 4, n4 FROM tmp_historial UNION ALL
  SELECT fecha, 5, n5 FROM tmp_historial UNION ALL
  SELECT fecha, 6, n6 FROM tmp_historial
) p
JOIN sorteos s ON s.juego_id = 1 AND s.fecha = p.fecha;

DROP TABLE tmp_historial;

-- ============================================================================
-- Verificación rápida (debe mostrar: 22 sorteos y 132 números)
-- ============================================================================
SELECT (SELECT COUNT(*) FROM sorteos)        AS sorteos,
       (SELECT COUNT(*) FROM sorteo_numeros) AS numeros,
       (SELECT COUNT(*) FROM usuarios)       AS usuarios;
