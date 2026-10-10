import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../../../components/AuthLayout.jsx';
import { PasswordField, PasswordStrengthMeter } from '../../../components/PasswordField.jsx';
import { IconAlert, IconArrowRight, IconKey, IconUser } from '../../../components/icons.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { resetPassword } from '../services/auth.service.js';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    usuario: params.get('usuario') || '',
    code: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const mismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword;

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword({ usuario: form.usuario.trim(), code: form.code.trim(), newPassword: form.newPassword });
      toast.success('Contraseña restablecida. Ya puedes iniciar sesión.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Nueva contraseña"
      subtitle="Escribe el código de 6 dígitos que recibiste por correo y elige tu nueva contraseña."
      onSubmit={submit}
    >
      {error && (
        <div className="alert error">
          <IconAlert width={17} height={17} />
          <span>{error}</span>
        </div>
      )}

      <label>Usuario</label>
      <div className="input-icon">
        <IconUser />
        <input
          value={form.usuario}
          onChange={(e) => setForm({ ...form, usuario: e.target.value })}
          autoComplete="username"
          required
        />
      </div>

      <label>Código de verificación</label>
      <div className="input-icon">
        <IconKey />
        <input
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          required
        />
      </div>

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
        <button className="btn-primary" disabled={loading || mismatch || form.code.length !== 6}>
          {loading ? 'Guardando...' : 'Restablecer contraseña'} <IconArrowRight />
        </button>
      </div>

      <Link to="/forgot-password" className="login-inline-link">¿No te llegó el código? Solicitar otro</Link>
      <br />
      <Link to="/login" className="login-back-link">← Volver al inicio de sesión</Link>
    </AuthLayout>
  );
}
