import { useState } from 'react';
import { IconLock, IconEye, IconEyeOff } from './icons.jsx';

function passwordStrength(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

const strengthLabels = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'];

export function PasswordStrengthMeter({ value }) {
  if (!value) return null;
  const score = passwordStrength(value);
  return (
    <div className="pw-strength">
      <div className="pw-strength-track">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`pw-strength-seg ${i < score ? `level-${score}` : ''}`} />
        ))}
      </div>
      <span className={`pw-strength-label level-${score}`}>{strengthLabels[score]}</span>
    </div>
  );
}

export function PasswordField({ value, onChange, placeholder, autoComplete, autoFocus, required = true, minLength = 8 }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-icon input-icon-end">
      <IconLock />
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        minLength={minLength || undefined}
        required={required}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="input-end-btn"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <IconEyeOff width={16} height={16} /> : <IconEye width={16} height={16} />}
      </button>
    </div>
  );
}
