# Event Ticket Management System

## Overview

This is a full-stack event ticketing application built with React and Express.js. The system allows users to create and manage events, generate tickets, and validate tickets through QR code scanning. It provides a complete event management workflow with a modern web interface, robust backend API, comprehensive error logging, and Bootstrap-style user notifications.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Features

### Error Logging System (Added August 2025)
- **Comprehensive System Logging**: All server errors are automatically logged to a `system_logs` table with detailed context including stack traces, user information, and request metadata
- **90-Day Retention Policy**: Logs are automatically cleaned up after 90 days to manage storage
- **Error Classification**: System distinguishes between user errors (400-499 status codes) and system faults (500+ status codes, network failures)
- **Logging Levels**: Three severity levels - `error` for system faults, `warning` for validation issues, and `info` for important operations
- **API Access**: System logs can be accessed via `/api/system-logs` endpoint for monitoring and debugging

### Bootstrap-Style Toast Notifications (Added August 2025)
- **Visual Feedback**: Three toast variants matching Bootstrap styling:
  - Success (green with checkmark ✓): For successful operations
  - Error (red with X icon ✗): For user errors and validation failures  
  - System Fault (yellow with alert icon ⚠): For server/system errors with "System Fault Detected:" prefix
- **Automatic Dismissal**: Toasts auto-dismiss after 4 seconds for success/error, 6 seconds for system faults
- **Consistent UX**: All user interactions provide immediate visual feedback through toast notifications

### Enhanced Event Management (Added August 2025)
- **Date/Time Validation**: Events now have "Starts on" and "Ends on" fields with validation ensuring end time comes after start time
- **Multi-Day Events**: Support for events spanning multiple days with proper date/time handling
- **Improved Error Messages**: User-friendly error messages with clear guidance on what went wrong

## System Architecture

### Frontend Architecture
The client uses React with TypeScript, built using Vite as the build tool. The UI is constructed with shadcn/ui components built on top of Radix UI primitives, styled with Tailwind CSS. Key architectural decisions include:

- **Component Library**: Uses shadcn/ui for consistent, accessible UI components
- **Routing**: Implements wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Styling**: Tailwind CSS with custom CSS variables for theming

### Backend Architecture
The server is built with Express.js and follows a RESTful API design pattern:

- **Server Framework**: Express.js with TypeScript for type safety
- **Data Storage**: Configurable storage interface with in-memory implementation (MemStorage class)
- **API Structure**: RESTful endpoints for events, tickets, and validation operations
- **Middleware**: Custom logging middleware for API request tracking
- **Error Handling**: Centralized error handling with proper HTTP status codes

### Data Layer
The application uses Drizzle ORM for database operations with PostgreSQL:

- **Schema Definition**: Centralized schema in `shared/schema.ts` with events and tickets tables
- **Type Generation**: Drizzle generates TypeScript types from schema definitions
- **Validation**: Zod schemas for runtime validation of data
- **Database Connection**: Neon serverless PostgreSQL connection

### Development Environment
The project is configured for seamless development with:

- **Development Server**: Vite dev server with Hot Module Replacement (HMR)
- **Build Process**: ESBuild for server bundling, Vite for client bundling
- **TypeScript**: Strict type checking across client, server, and shared code
- **Path Aliases**: Configured for clean imports (@/, @shared/, etc.)

### QR Code System
The application implements QR code generation and scanning for ticket validation:

- **Generation**: Client-side QR code generation for tickets
- **Validation**: Server-side ticket validation through QR data lookup
- **Scanner Interface**: Web-based QR scanner component for ticket validation

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon database
- **drizzle-orm**: Type-safe ORM for database operations
- **drizzle-kit**: CLI tools for database migrations and schema management
- **express**: Node.js web framework for the API server

### Frontend UI Dependencies
- **@radix-ui/***: Comprehensive collection of accessible UI primitives
- **@tanstack/react-query**: Server state management and data fetching
- **react-hook-form**: Performant forms with easy validation
- **wouter**: Minimalist routing library for React
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: For creating variant-based component APIs

### Development and Build Tools
- **vite**: Fast build tool and development server
- **tsx**: TypeScript execution environment for development
- **esbuild**: Fast JavaScript bundler for production builds
- **@replit/vite-plugin-runtime-error-modal**: Replit-specific error handling
- **@replit/vite-plugin-cartographer**: Replit development tooling

### Utility Libraries
- **zod**: TypeScript-first schema validation
- **date-fns**: Modern JavaScript date utility library
- **clsx**: Utility for constructing className strings conditionally
- **cmdk**: Command menu component
- **embla-carousel-react**: Carousel component library