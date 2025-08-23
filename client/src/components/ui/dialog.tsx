// Re-export modal components as dialog for compatibility
export { 
  Modal as Dialog, 
  ModalHeader as DialogHeader,
  ModalBody as DialogContent,
  ModalFooter as DialogFooter
} from "./modal";

// Export placeholder components for compatibility
export const DialogTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DialogClose = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DialogOverlay = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DialogTitle = ({ children }: { children: React.ReactNode }) => <h5 className="modal-title">{children}</h5>;
export const DialogDescription = ({ children }: { children: React.ReactNode }) => <p className="text-muted">{children}</p>;