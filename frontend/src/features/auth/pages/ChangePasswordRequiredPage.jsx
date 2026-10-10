import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../../../components/AuthLayout.jsx';
import { PasswordField, PasswordStrengthMeter } from '../../../components/PasswordField.jsx';
import { IconAlert, IconArrowRight } from '../../../components/icons.jsx';
import { changeMyPassword } from '../services/auth.service.js';
import { clearSession, getToken, getUser, saveSession } from '../session.js';

/** Pantalla obligatoria: contraseña temporal (usuario nuevo o restablecida por un administrador). */
export default function ChangePasswordRequiredPage() {
  const navigate = useNavigate();
  const user = getUser();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!getToken() || !user) return <Navigate to="/login" replace />;

  const mismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword;

  async function submit(e) {
    e.preventDefault();
    if (mismatch || form.newPassword !== form.confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const session = await changeMyPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      saveSession(session);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <AuthLayout
      title="Crea tu contraseña"
      subtitle={`Hola${user.nombre ? `, ${user.nombre.split(' ')[0]}` : ''}. Por seguridad debes reemplazar la contraseña temporal antes de continuar.`}
      onSubmit={submit}
    >
      {error && (
        <div className="alert error">
          <IconAlert width={17} height={17} />
          <span>{error}</span>
        </div>
      )}

      <label>Contraseña actual (la temporal)</label>
      <PasswordField
        value={form.currentPassword}
        onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
        autoComplete="current-password"
        autoFocus
        minLength={0}
      />

      <label>Nueva contraseña</label>
      <PasswordField
        value={form.newPassword}
        onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        autoComplete="new-password"
        placeholder="Mín. 8 caracteres, con letras y números"
      />
      <PasswordStrengthMeter value={form.newPassword} />

      <label>Confirma la nueva contraseña</label>
      <PasswordField
        value={form.confirmPassword}
        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        autoComplete="new-password"
      />
      {mismatch && <span className="field-error">Las contraseñas no coinciden.</span>}

      <div className="auth-actions">
        <button className="btn-primary" disabled={saving || mismatch}>
          {saving ? 'Guardando...' : 'Guardar y continuar'} <IconArrowRight />
        </button>
        <button type="button" className="btn-link" onClick={cancel}>Cerrar sesión</button>
      </div>
    </AuthLayout>
  );
}
