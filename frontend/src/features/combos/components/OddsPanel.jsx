import { useEffect, useState } from 'react';
import { IconAlert } from '../../../components/icons.jsx';
import { getOdds } from '../services/combos.service.js';
import { formatMoney, formatOneIn, formatPercent } from '../../../utils/money.js';

/** Probabilidad exacta de cada resultado al jugar una combinación. */
export default function OddsPanel() {
  const [odds, setOdds] = useState(null);

  useEffect(() => {
    getOdds().then(setOdds).catch(() => {});
  }, []);

  if (!odds) return null;

  return (
    <div className="panel table-wrap">
      <h3 className="panel-title">Tus probabilidades reales</h3>
      <p className="panel-note">
        Con una combinación hay <b>{odds.combinacionesPosibles.toLocaleString('en-US')}</b> resultados posibles, y todos tienen
        la misma probabilidad. Por azar se esperan <b>{odds.aciertosEsperados}</b> aciertos por combinación.
        La jugada sencilla cuesta {formatMoney(odds.precioBoleto)} y la doble {formatMoney(odds.precioDoble)}.
      </p>

      <table>
        <thead>
          <tr>
            <th>Aciertos</th>
            <th>Probabilidad</th>
            <th>Equivale a</th>
          </tr>
        </thead>
        <tbody>
          {odds.filas.map((row) => (
            <tr key={row.aciertos}>
              <td><strong>{row.aciertos}</strong></td>
              <td>{formatPercent(row.probabilidad)}</td>
              <td>{formatOneIn(row.unoEn)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="alert" style={{ marginTop: 14 }}>
        <IconAlert width={17} height={17} />
        <span>
          Estas probabilidades valen para <b>cualquier</b> combinación, la generes como la generes. Jugar más boletos
          sube tu probabilidad en la misma proporción en que sube tu gasto.
        </span>
      </div>
    </div>
  );
}
