/** Marco común de las pantallas de acceso: panel de marca a la izquierda y tarjeta con formulario a la derecha. */
export default function AuthLayout({ title, subtitle, onSubmit, children }) {
  return (
    <div className="login-shell">
      <div className="login-box">
        <aside className="login-aside">
          <div className="login-aside-top">
            <div className="brand large light">Loto <span>Números</span></div>
          </div>
        </aside>

        <div className="login-panel">
          <form className="login-card" onSubmit={onSubmit}>
            <div className="login-card-head">
              <div className="brand large">Loto <span>Números</span></div>
              <h2 className="auth-title">{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {children}
          </form>
        </div>
      </div>
    </div>
  );
}
