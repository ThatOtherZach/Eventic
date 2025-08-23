import * as React from "react";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className = "", ...props }, ref) => {
  return (
    <textarea
      className={`form-control ${className}`}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };