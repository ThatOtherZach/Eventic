import React, { forwardRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AccessibleButtonProps extends ButtonProps {
  label?: string; // Screen reader label
  description?: string; // Additional context for screen readers
  keyboardShortcut?: string; // e.g., "Ctrl+S"
  loading?: boolean;
  loadingText?: string;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ 
    label, 
    description, 
    keyboardShortcut,
    loading,
    loadingText = 'Loading...',
    children,
    disabled,
    className,
    onClick,
    ...props 
  }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Prevent double-clicks during loading
      if (loading) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Allow both Enter and Space to activate button
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!loading && !disabled) {
          onClick?.(e as any);
        }
      }
    };

    return (
      <Button
        ref={ref}
        className={cn(
          'focus-visible:ring-2 focus-visible:ring-offset-2',
          'transition-all duration-200',
          loading && 'opacity-70 cursor-wait',
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={label}
        aria-describedby={description ? `${props.id}-description` : undefined}
        aria-disabled={disabled || loading}
        aria-busy={loading}
        title={keyboardShortcut ? `${label || ''} (${keyboardShortcut})` : label}
        {...props}
      >
        {loading ? (
          <>
            <span className="sr-only">{loadingText}</span>
            <span aria-hidden="true" className="inline-flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {children}
            </span>
          </>
        ) : (
          children
        )}
        {description && (
          <span id={`${props.id}-description`} className="sr-only">
            {description}
          </span>
        )}
      </Button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';