import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

export interface BootstrapToast {
  id: string;
  title?: string;
  description?: string;
  variant?: "success" | "error" | "info" | "warning" | "destructive" | "default";
  duration?: number;
}

interface ToastContainerProps {
  toasts: BootstrapToast[];
  onDismiss: (id: string) => void;
}

const getIcon = (variant?: string) => {
  switch (variant) {
    case "success":
      return <CheckCircle size={20} className="text-success" />;
    case "error":
    case "destructive":
      return <XCircle size={20} className="text-danger" />;
    case "warning":
      return <AlertTriangle size={20} className="text-warning" />;
    default:
      return <Info size={20} className="text-primary" />;
  }
};

const getToastClass = (variant?: string) => {
  switch (variant) {
    case "success":
      return "border-success";
    case "error":
    case "destructive":
      return "border-danger";
    case "warning":
      return "border-warning";
    default:
      return "border-primary";
  }
};

export const BootstrapToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      className="position-fixed top-0 end-0 p-3"
      style={{ zIndex: 9999 }}
      data-testid="toast-container"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: BootstrapToast; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    setTimeout(() => setShow(true), 10);

    // Auto dismiss after duration
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(() => onDismiss(toast.id), 300); // Wait for animation
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={`toast align-items-center bg-white border-2 ${getToastClass(toast.variant)} ${
        show ? "show" : ""
      } mb-3`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        transition: "all 0.3s ease-in-out",
        opacity: show ? 1 : 0,
        transform: show ? "translateX(0)" : "translateX(100%)",
        minWidth: "350px",
        boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
      }}
      data-testid={`toast-${toast.variant || "info"}`}
    >
      <div className="d-flex">
        <div className="toast-body d-flex align-items-start">
          <div className="me-3">{getIcon(toast.variant)}</div>
          <div className="flex-grow-1">
            {toast.title && <div className="fw-bold mb-1">{toast.title}</div>}
            {toast.description && <div className="text-muted small">{toast.description}</div>}
          </div>
        </div>
        <button
          type="button"
          className="btn-close me-2 m-auto"
          aria-label="Close"
          onClick={() => {
            setShow(false);
            setTimeout(() => onDismiss(toast.id), 300);
          }}
          data-testid="button-close-toast"
        />
      </div>
    </div>
  );
};