import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../../components/AuthLayout.jsx';
import { IconAlert, IconArrowRight, IconUser } from '../../../components/icons.jsx';
import { forgotPassword } from '../services/auth.service.js';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await forgotPassword(usuario.trim());
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo procesar la solicitud');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Ingresa tu usuario y te enviaremos un código de verificación al correo registrado en tu cuenta."
      onSubmit={submit}
    >
      {error && (
        <div className="alert error">
          <IconAlert width={17} height={17} />
          <span>{error}</span>
        </div>
      )}

      {message ? (
        <>
          <div className="alert">{message}</div>
          <p className="auth-hint">El código vence en 10 minutos. Revisa también la carpeta de spam.</p>
          <div className="auth-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(`/reset-password?usuario=${encodeURIComponent(usuario.trim())}`)}
            >
              Ya tengo el código <IconArrowRight />
            </button>
          </div>
        </>
      ) : (
        <>
          <label>Usuario</label>
          <div className="input-icon">
            <IconUser />
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="auth-actions">
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar código'} <IconArrowRight />
            </button>
          </div>
        </>
      )}

      <Link to="/login" className="login-back-link">← Volver al inicio de sesión</Link>
    </AuthLayout>
  );
}
