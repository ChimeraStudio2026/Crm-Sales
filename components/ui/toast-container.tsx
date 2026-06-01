'use client';

import { useCrm } from '@/providers/crm-provider';

export function ToastContainer() {
  const { toasts } = useCrm();
  return (
    <div className="toast-container" id="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type} show`}>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
