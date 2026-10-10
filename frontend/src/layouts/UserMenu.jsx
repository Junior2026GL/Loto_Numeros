import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { PasswordField, PasswordStrengthMeter } from '../components/PasswordField.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { IconKey, IconLogout, IconChevronDown, IconShield } from '../components/icons.jsx';
import { changeMyPassword } from '../features/auth/services/auth.service.js';
import { clearSession, saveSession } from '../features/auth/session.js';

const roleLabels = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  NORMAL: 'Normal',
};

const roleTones = {
  SUPER_ADMIN: 'amber',
  ADMIN: 'blue',
  NORMAL: 'green',
};

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

const emptyPasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

function ChangePasswordModal({ onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyPasswordForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const confirmTouched = form.confirmPassword.length > 0;
  const passwordsMatch = form.newPassword === form.confirmPassword;
  const confirmMismatch = confirmTouched && !passwordsMatch;
  const canSubmit = form.currentPassword && form.newPassword.length >= 8 && confirmTouched && passwordsMatch;

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!passwordsMatch) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setSaving(true);
    try {
      // Al cambiar la contraseña las demás sesiones caducan: se guarda el token nuevo.
      saveSession(await changeMyPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }));
      toast.success('Contraseña actualizada correctamente.');
      setForm(emptyPasswordForm);
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || 'No se pudo cambiar la contraseña';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Cambiar contraseña"
      subtitle="Mantén tu cuenta protegida con una contraseña segura."
      icon={<IconKey />}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button type="submit" form="form-cambiar-password" className="btn-primary" disabled={saving || !canSubmit}>
            {saving ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </>
      }
    >
      <form id="form-cambiar-password" className="form-sections" onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}

        <fieldset className="form-section">
          <legend>Verifica tu identidad</legend>
          <div className="form-stack">
            <label>Contraseña actual</label>
            <PasswordField
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              autoComplete="current-password"
              minLength={0}
              autoFocus
            />
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Nueva contraseña</legend>
          <div className="form-stack">
            <div className="field-group">
              <label>Nueva contraseña</label>
              <PasswordField
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="Mín. 8 caracteres"
                autoComplete="new-password"
              />
              <PasswordStrengthMeter value={form.newPassword} />
            </div>

            <div className="field-group">
              <label>Confirmar nueva contraseña</label>
              <PasswordField
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
              />
              {confirmMismatch && <small className="field-error">Las contraseñas no coinciden.</small>}
            </div>
          </div>
        </fieldset>

        <div className="security-tip">
          <IconShield width={16} height={16} />
          <span>Usa una contraseña única que no utilices en otros sitios y evita datos obvios como tu nombre o fecha de nacimiento.</span>
        </div>
      </form>
    </Modal>
  );
}

export default function UserMenu({ user }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function logout() {
    clearSession();
    navigate('/login');
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button className={`user-menu-trigger ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span className={`avatar sm ring-${roleTones[user?.rol] || 'blue'}`}>{initials(user?.nombre)}</span>
        <div className="user-menu-info">
          <small>{user?.nombre || 'Usuario'}</small>
          {user?.rol && <span className={`role-badge ${user.rol}`}>{roleLabels[user.rol] || user.rol}</span>}
        </div>
        <IconChevronDown className="user-menu-chevron" style={open ? { transform: 'rotate(180deg)' } : undefined} />
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <span className={`avatar ring-${roleTones[user?.rol] || 'blue'}`} style={{ width: 40, height: 40, fontSize: 14 }}>
              {initials(user?.nombre)}
            </span>
            <div className="user-menu-header-text">
              <b>{user?.nombre || 'Usuario'}</b>
              <small>@{user?.usuario}</small>
              {user?.rol && <span className={`role-badge ${user.rol}`}>{roleLabels[user.rol] || user.rol}</span>}
            </div>
          </div>

          <div className="user-menu-divider" />

          <button onClick={() => { setShowPassword(true); setOpen(false); }}>
            <span className="user-menu-item-icon purple"><IconKey width={15} height={15} /></span>
            Cambiar contraseña
          </button>

          <div className="user-menu-divider" />

          <button className="danger" onClick={logout}>
            <span className="user-menu-item-icon red"><IconLogout width={15} height={15} /></span>
            Cerrar sesión
          </button>
        </div>
      )}

      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}
    </div>
  );
}
