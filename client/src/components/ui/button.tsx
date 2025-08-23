import * as React from "react";

const buttonVariants = {
  default: "btn-primary",
  destructive: "btn-danger",
  outline: "btn-outline-secondary",
  secondary: "btn-secondary",
  ghost: "btn-link",
  link: "btn-link",
};

const buttonSizes = {
  default: "",
  sm: "btn-sm",
  lg: "btn-lg",
  icon: "btn-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", type = "button", ...props }, ref) => {
    const variantClass = buttonVariants[variant] || buttonVariants.default;
    const sizeClass = buttonSizes[size] || "";
    
    return (
      <button
        type={type}
        className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };