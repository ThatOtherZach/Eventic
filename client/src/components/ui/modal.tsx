import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onOpenChange, children, className = "" }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="modal-backdrop show" 
        onClick={() => onOpenChange(false)}
        style={{ zIndex: 1040 }}
      />
      
      {/* Modal */}
      <div 
        className="modal show d-block" 
        tabIndex={-1}
        style={{ zIndex: 1050 }}
      >
        <div className={`modal-dialog modal-dialog-centered ${className}`}>
          <div className="modal-content" ref={modalRef}>
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export function ModalHeader({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-header">
      <h5 className="modal-title">{children}</h5>
      {onClose && (
        <button 
          type="button" 
          className="btn-close" 
          onClick={onClose}
          aria-label="Close"
        />
      )}
    </div>
  );
}

export function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="modal-body">{children}</div>;
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="modal-footer">{children}</div>;
}