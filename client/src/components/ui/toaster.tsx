import { useToast } from "@/hooks/use-toast";
import { BootstrapToastContainer } from "@/components/ui/bootstrap-toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  const bootstrapToasts = toasts.map((toast) => {
    // Map the variant to Bootstrap-style variants
    let variant: "success" | "error" | "info" | "warning" | "destructive" | "default" | "system" | undefined;
    
    // Check if this is a system error based on the description
    if (toast.description?.toString().includes("System Fault Detected:")) {
      variant = "system";
    } else if (toast.variant === "destructive") {
      variant = "error";
    } else if (toast.variant && (toast.variant === "success" || toast.variant === "error" || toast.variant === "warning")) {
      variant = toast.variant as "success" | "error" | "warning";
    } else {
      variant = "info";
    }

    return {
      id: toast.id,
      title: toast.title?.toString(),
      description: toast.description?.toString(),
      variant,
      duration: 15000, // 15 seconds
    };
  });

  return <BootstrapToastContainer toasts={bootstrapToasts} onDismiss={dismiss} />;
}