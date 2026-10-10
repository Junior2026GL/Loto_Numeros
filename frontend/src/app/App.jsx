import { RouterProvider } from 'react-router-dom';
import { router } from './router.jsx';
import { ToastProvider } from '../components/ToastProvider.jsx';

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
