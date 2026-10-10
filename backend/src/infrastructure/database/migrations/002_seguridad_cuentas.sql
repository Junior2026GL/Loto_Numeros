-- Seguridad de las cuentas:
--  * debe_cambiar_password: obliga a cambiar la contraseña en el siguiente ingreso
--    (usuarios nuevos, contraseñas restablecidas por un admin y el superadmin inicial).
--  * sesiones_desde: segundos (época Unix) a partir de los cuales un token es válido.
--    Al cambiar o restablecer la contraseña se actualiza y las sesiones anteriores caducan.
--  * password_reset_codes: códigos de recuperación de contraseña enviados por correo.
--  * Se elimina el teléfono de los usuarios: ya no se usa.

ALTER TABLE usuarios
  ADD COLUMN debe_cambiar_password TINYINT(1)   NOT NULL DEFAULT 0 AFTER activo,
  ADD COLUMN sesiones_desde        INT UNSIGNED NOT NULL DEFAULT 0 AFTER debe_cambiar_password,
  DROP COLUMN telefono;

-- La contraseña inicial del superadmin se comparte por fuera: debe cambiarse al primer ingreso.
UPDATE usuarios SET debe_cambiar_password = 1 WHERE usuario = 'superadmin';

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  code_hash  VARCHAR(255)    NOT NULL,
  intentos   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME        NOT NULL,
  used_at    DATETIME        NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reset_usuario (usuario_id),
  CONSTRAINT fk_reset_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;
