-- Presupuesto y premios de las combinaciones:
--  * costo: lo que costó el boleto cuando el usuario marcó la combinación como jugada.
--  * premio: lo que ganó (lo escribe el usuario).
--  * preferencias_usuario: límite de gasto mensual (opcional) de cada usuario.
--  * precio_boleto: precio de un boleto, ajustable por el superadmin.

ALTER TABLE combinaciones
  ADD COLUMN costo  DECIMAL(10,2) NULL AFTER jugada,
  ADD COLUMN premio DECIMAL(12,2) NULL AFTER costo;

CREATE TABLE IF NOT EXISTS preferencias_usuario (
  usuario_id     BIGINT UNSIGNED PRIMARY KEY,
  limite_mensual DECIMAL(10,2) NULL,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pref_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO configuracion (clave, valor) VALUES ('precio_boleto', '20');
