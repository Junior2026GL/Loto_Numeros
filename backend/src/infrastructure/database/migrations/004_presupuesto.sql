-- Presupuesto y premios de las combinaciones:
--  * modalidad: cómo se jugó (SENCILLA o DOBLE); define cuánto cuesta.
--  * costo: lo que costó el boleto cuando el usuario marcó la combinación como jugada.
--  * premio: lo que ganó (lo escribe el usuario).
--  * preferencias_usuario: límite de gasto mensual (opcional) de cada usuario.
--  * precio_boleto / precio_doble: precios de la jugada sencilla y de la doble, ajustables por el superadmin.

ALTER TABLE combinaciones
  ADD COLUMN modalidad ENUM('SENCILLA','DOBLE') NOT NULL DEFAULT 'SENCILLA' AFTER jugada,
  ADD COLUMN costo     DECIMAL(10,2) NULL AFTER modalidad,
  ADD COLUMN premio    DECIMAL(12,2) NULL AFTER costo;

CREATE TABLE IF NOT EXISTS preferencias_usuario (
  usuario_id     BIGINT UNSIGNED PRIMARY KEY,
  limite_mensual DECIMAL(10,2) NULL,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pref_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO configuracion (clave, valor) VALUES ('precio_boleto', '10'), ('precio_doble', '20');
