import LotteryBall from './LotteryBall.jsx';
import { IconCalendar, IconChart, IconShuffle } from './icons.jsx';

// Números de ejemplo (decorativos) para el panel de marca.
const SAMPLE_BALLS = [4, 11, 17, 23, 29, 33];

const FEATURES = [
  [IconCalendar, 'Sorteos los miércoles y sábados, 9:00 p. m.'],
  [IconChart, 'Estadísticas de todo el historial'],
  [IconShuffle, 'Seguimiento de tus combinaciones'],
];

/** Panel de marca de las pantallas de acceso. */
export default function AuthAside() {
  return (
    <aside className="login-aside">
      <div className="login-aside-top">
        <div className="brand large light">Loto <span>Números</span></div>
      </div>

      <div className="aside-hero">
        <h1>Los resultados del SuperPremio, siempre al día</h1>
        <p>Consulta el historial, analiza las estadísticas y lleva el control de tus combinaciones.</p>

        <div className="aside-balls" aria-hidden="true">
          {SAMPLE_BALLS.map((n, i) => (
            <span className="float-ball" style={{ animationDelay: `${i * 0.35}s` }} key={n}>
              <LotteryBall number={n} size="xl" />
            </span>
          ))}
        </div>
      </div>

      <ul className="aside-features">
        {FEATURES.map(([Icon, text]) => (
          <li key={text}>
            <span className="aside-feature-icon"><Icon width={16} height={16} /></span>
            {text}
          </li>
        ))}
      </ul>

      <p className="aside-note">Juega con responsabilidad. Las estadísticas describen el pasado y no predicen resultados.</p>
    </aside>
  );
}
