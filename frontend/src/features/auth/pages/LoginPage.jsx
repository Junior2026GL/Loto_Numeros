import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuthOptions, login } from '../services/auth.service.js';
import { saveSession } from '../session.js';
import { PasswordField } from '../../../components/PasswordField.jsx';
import { IconUser, IconArrowRight, IconAlert } from '../../../components/icons.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ usuario: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [canRecover, setCanRecover] = useState(false);

  useEffect(() => {
    getAuthOptions().then((o) => setCanRecover(o.recuperacionPorCorreo)).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await login(form);
      saveSession(data);
      navigate(data.user.debeCambiarPassword ? '/cambiar-password' : '/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-box">
        <aside className="login-aside">
          <div className="login-aside-top">
            <div className="brand large light">Loto <span>Números</span></div>
          </div>
        </aside>

        <div className="login-panel">
          <form className="login-card" onSubmit={submit}>
            <div className="login-card-head">
              <div className="brand large">Loto <span>Números</span></div>
              <p>Ingresa con tu usuario</p>
            </div>

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
                type="text"
                autoComplete="username"
                value={form.usuario}
                onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                autoFocus
                required
              />
            </div>

            <div className="login-password-group">
              <label>Contraseña</label>
              <PasswordField
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                minLength={0}
              />
              {canRecover && <Link to="/forgot-password" className="login-inline-link">¿Olvidaste tu contraseña?</Link>}
            </div>

            <button className="btn-primary" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'} <IconArrowRight />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
