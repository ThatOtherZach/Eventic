import React from 'react';

export function SkipNavigation() {
  return (
    <a 
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded"
      data-testid="link-skip-navigation"
    >
      Skip to main content
    </a>
  );
}