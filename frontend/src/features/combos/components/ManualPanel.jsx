import { useState } from 'react';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconSave } from '../../../components/icons.jsx';
import SimulateModal from './SimulateModal.jsx';
import { saveCombination } from '../services/combos.service.js';
import { capitalize, dayName, formatDate } from '../../../utils/dates.js';

const PICK = 6;

/** Para quien ya tiene sus propios números: los guarda para el próximo sorteo. */
export default function ManualPanel({ nextDraw, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState(Array(PICK).fill(''));
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(null);

  const numbers = values.map(Number);
  const complete = values.every((v) => v !== '');
  const valid = complete && numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 33) && new Set(numbers).size === PICK;

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveCombination({ estrategia: 'MANUAL', numeros: numbers, fecha: nextDraw?.fecha });
      toast.success('Combinación guardada.');
      setValues(Array(PICK).fill(''));
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar la combinación');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel panel-soft" onSubmit={save}>
      <h3 className="panel-title">¿Ya tienes tus propios números?</h3>
      <p className="panel-note">
        Escríbelos aquí ({PICK} números distintos, del 1 al 33) y guárdalos
        {nextDraw && <> para el sorteo del <b>{capitalize(dayName(nextDraw.dia_semana))} {formatDate(nextDraw.fecha)}</b></>}.
      </p>
      <div className="manual-inputs">
        {values.map((value, i) => (
          <input
            key={i}
            type="number"
            inputMode="numeric"
            min="1"
            max="33"
            value={value}
            aria-label={`Número ${i + 1}`}
            onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}
          />
        ))}
        <button className="btn-primary" disabled={!valid || saving || !nextDraw}>
          <IconSave /> {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="btn-outline" disabled={!valid} onClick={() => setSimulating(numbers)}>
          ¿Cómo le habría ido?
        </button>
      </div>
      {complete && !valid && <span className="field-error">Deben ser {PICK} números distintos entre 1 y 33.</span>}

      {simulating && <SimulateModal numbers={simulating} onClose={() => setSimulating(null)} />}
    </form>
  );
}
