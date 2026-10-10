import { useEffect, useState } from 'react';
import PageHeader from '../../../components/PageHeader.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { IconSave } from '../../../components/icons.jsx';
import { getSettings, saveSettings } from '../services/settings.service.js';

const WEIGHT_FIELDS = [
  ['frecuencia', 'Frecuencia', 'Qué tanto pesa que el número haya salido muchas veces.'],
  ['atraso', 'Atraso', 'Qué tanto pesa que lleve muchos sorteos sin salir.'],
  ['caliente', 'Calientes', 'Qué tanto pesa que haya salido en los sorteos más recientes.'],
];

export default function SettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setForm)
      .catch((err) => setError(err.response?.data?.message || 'No se pudo cargar la configuración'));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      setForm(await saveSettings(form));
      toast.success('Configuración guardada.');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  const total = form ? Object.values(form.pesos).reduce((a, b) => a + Number(b || 0), 0) : 0;

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Ajustes de las estadísticas y del puntaje que usan las combinaciones."
      />

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

      {form && (
        <form className="panel settings-form" onSubmit={submit}>
          <h3 className="panel-title">Números calientes</h3>
          <div className="settings-field">
            <label>Sorteos recientes que se consideran</label>
            <input
              type="number"
              min="1"
              max="50"
              value={form.ventanaCalientes}
              onChange={(e) => setForm({ ...form, ventanaCalientes: e.target.value })}
              required
            />
            <p className="auth-hint">Un número es «caliente» si se repitió mucho en este número de sorteos más recientes.</p>
          </div>

          <h3 className="panel-title" style={{ marginTop: 26 }}>Puntaje de cada número</h3>
          <p className="panel-note">
            El puntaje combina tres factores. Los pesos se ajustan solos para sumar 100 %, así que no hace falta que
            sumen exactamente 100. Suma actual: <b>{total}</b>.
          </p>
          <div className="settings-weights">
            {WEIGHT_FIELDS.map(([key, label, help]) => (
              <div className="settings-field" key={key}>
                <label>{label}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.pesos[key]}
                  onChange={(e) => setForm({ ...form, pesos: { ...form.pesos, [key]: e.target.value } })}
                  required
                />
                <p className="auth-hint">{help}</p>
              </div>
            ))}
          </div>

          <div className="alert" style={{ marginTop: 18 }}>
            Cambiar estos valores modifica cómo se calculan las estadísticas y las combinaciones, pero no
            cambia la probabilidad de ningún sorteo.
          </div>

          <div style={{ marginTop: 18 }}>
            <button className="btn-primary" disabled={saving}>
              <IconSave /> {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
