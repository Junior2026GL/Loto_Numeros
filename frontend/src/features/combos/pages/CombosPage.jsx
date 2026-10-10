import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader.jsx';
import { IconAlert } from '../../../components/icons.jsx';
import GeneratorPanel from '../components/GeneratorPanel.jsx';
import ManualPanel from '../components/ManualPanel.jsx';
import WheelPanel from '../components/WheelPanel.jsx';
import MyCombosPanel from '../components/MyCombosPanel.jsx';
import BudgetPanel from '../components/BudgetPanel.jsx';
import AnalysisPanel from '../components/AnalysisPanel.jsx';
import { getSummary as getDrawsSummary } from '../../draws/services/draws.service.js';

// [id, nombre de la pestaña, qué se hace en ella]
const TABS = [
  ['generador', 'Generar', 'Genera combinaciones y guárdalas para el próximo sorteo.'],
  ['cobertura', 'Cobertura', 'Reparte un grupo de tus números en varios boletos para asegurar un premio menor.'],
  ['mis', 'Mis combinaciones', 'Tus combinaciones guardadas: márcalas como jugadas y registra lo que ganes.'],
  ['presupuesto', 'Presupuesto', 'Cuánto llevas gastado y ganado, y tu límite mensual.'],
  ['analisis', 'Análisis', 'Probabilidades reales y una prueba de las estrategias con sorteos pasados.'],
];

export default function CombosPage() {
  const [tab, setTab] = useState('generador');
  const [nextDraw, setNextDraw] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    getDrawsSummary().then((s) => setNextDraw(s.proximo)).catch(() => {});
  }, []);

  // Cualquier cambio (guardar, jugar, premio, borrar) refresca las pestañas que muestran datos.
  const changed = () => setReload((n) => n + 1);
  const help = TABS.find(([id]) => id === tab)?.[2];

  return (
    <>
      <PageHeader
        title="Combinaciones"
        description="Genera combinaciones, llévalas al sorteo y controla lo que gastas y ganas."
      />

      <div className="alert stats-disclaimer">
        <IconAlert width={17} height={17} />
        <span>
          <b>Ninguna herramienta aumenta tu probabilidad de ganar:</b> todas las combinaciones tienen la misma
          probabilidad. Sirven para jugar con método y llevar el control. Juega con responsabilidad.
        </span>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            type="button"
            role="tab"
            key={id}
            className={`tab ${tab === id ? 'active' : ''}`}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="tab-help">{help}</p>

      {tab === 'generador' && (
        <>
          <GeneratorPanel nextDraw={nextDraw} onNextDraw={setNextDraw} onSaved={changed} />
          <ManualPanel nextDraw={nextDraw} onSaved={changed} />
        </>
      )}
      {tab === 'cobertura' && <WheelPanel nextDraw={nextDraw} onSaved={changed} />}
      {tab === 'mis' && <MyCombosPanel reload={reload} onChanged={changed} />}
      {tab === 'presupuesto' && <BudgetPanel reload={reload} />}
      {tab === 'analisis' && <AnalysisPanel reload={reload} />}
    </>
  );
}
