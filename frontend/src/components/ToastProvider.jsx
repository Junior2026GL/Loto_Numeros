import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { IconCheck, IconAlert, IconClose } from './icons.jsx';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const show = useCallback((message, type = 'success') => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, type }]);
    timers.current[id] = setTimeout(() => remove(id), 4000);
  }, [remove]);

  const api = {
    success: (message) => show(message, 'success'),
    error: (message) => show(message, 'error'),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? <IconCheck /> : <IconAlert />}
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => remove(t.id)} aria-label="Cerrar">
              <IconClose />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
