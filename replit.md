# Event Ticket Management System

## Overview

This is a full-stack event ticketing application built with React and Express.js. The system allows users to create and manage events, generate tickets, and validate tickets through QR code scanning. It provides a complete event management workflow with a modern web interface, robust backend API, comprehensive error logging, and Bootstrap-style user notifications.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Features

### Simplified Image System (Updated January 2025)
- **Single Upload**: Events now use only one image upload - the featured image
- **Dual Purpose**: The featured image serves as both the event display image and ticket background
- **Removed Complexity**: Eliminated separate ticket background upload to simplify user experience
- **Automatic Application**: When a featured image is uploaded, it automatically applies to ticket designs

### Raffle System (Added January 2025)
- **Optional Event Setting**: Raffle is an optional feature that can be enabled during event creation or editing
- **One-Way Activation**: Once enabled, raffle cannot be disabled to ensure fairness and prevent manipulation
- **Event Owner Raffle**: Event owners can run raffles to randomly select winners from ticket holders
- **Winner Selection**: Random selection from all eligible tickets (status = "sent")
- **Reroll Capability**: Owners can reroll to select a different winner if needed
- **Winner Notification**: Winners receive notification in their notification center
- **Ticket Display**: Winning tickets show "🎉 Raffle Winner! 🎉" badge with "Please see the event organizer" message
- **Database**: Added `raffleEnabled` field to events table and `isRaffleWinner`/`raffleWonAt` fields to tickets table
- **API Endpoints**: `/api/events/:id/raffle/eligible`, `/api/events/:id/raffle/draw`
- **UI Integration**: Raffle checkbox in event creation/edit forms, raffle button appears in event owner controls only when enabled

### Event Reputation System (Added January 2025)
- **Event Ratings**: Attendees can rate events with thumbs up/down on the event start date
- **One Vote Per Ticket**: Each ticket holder gets one vote, cannot be changed after submission
- **Reputation Score**: Event owners' reputation displayed as percentage on their account page
- **Rating UI**: Shows on ticket page once event has started with simple thumbs up/down buttons
- **Reputation Badges on Event Page**: 
  - "New" badge for 0% reputation
  - "Novice" badge for 1-25% reputation  
  - Raw percentage with vote count for 26%+ reputation
  - "Bestie" badge for organizers with 1,000+ total votes
- **Vote Count Formatting**: 1,000 → 1k, 999,000 → 999k, 1,000,000+ → +1M
- **Database**: Added `eventRatings` table tracking ratings per ticket with event owner association
- **API Endpoints**: `/api/tickets/:id/rate`, `/api/tickets/:id/rating`, `/api/users/:id/reputation`

### Ticket Resale System (Added January 2025)
- **Replaces Refund System**: Tickets can no longer be refunded, but can be listed for resale to other users
- **Price Enforcement**: Tickets can only be resold at their original purchase price - no markup allowed
- **Platform Fee**: 2% transaction fee is charged on resell transactions for paid tickets only
- **Free Ticket Returns**: Tickets purchased for $0.00 can be "returned" without any platform fee - they become immediately available for others
- **Resale Queue Management**: Tickets listed for resale are queued in order, with the first listed having priority for new purchases
- **Automatic Matching**: When users buy tickets for an event, they are automatically matched with the first available resell ticket before creating new tickets
- **Owner Transfer**: Resold tickets transfer from the original owner to the new buyer, with payment going directly to the original owner (minus 2% fee for paid tickets)
- **Database Changes**: Added `resellQueue`, `resellTransactions` tables and `resellStatus`/`originalOwnerId`/`purchasePrice` fields to tickets table
- **API Updates**: Replaced `/api/tickets/:id/refund` endpoint with `/api/tickets/:id/resell` endpoint
- **UI Changes**: Shows "Return" button for free tickets and "Resell" for paid tickets, with appropriate messaging for each

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

### Production Readiness Optimizations (January 2025)
- **Date Handling Robustness**: Fixed "Invalid time value" errors by adding proper date validation and error handling throughout the application
- **Authentication Resilience**: Improved JWKS verification to handle connectivity issues gracefully without breaking authentication
- **Error Logging Enhancement**: Enhanced error messages with better context and specific error details for debugging
- **Schema Optimization**: Added proper types for user reputation cache system with hourly update capability
- **Rate Limiting**: Comprehensive rate limiting on ticket purchases (3/min) and event creation (2/5min) with detailed logging
- **Input Validation**: Robust Zod validation schemas with comprehensive regex patterns for data integrity
- **Performance**: Implemented reputation caching system to reduce database load during high traffic

### Venue Address System (Added January 2025)
- **Separate Address Fields**: Venue creation now uses three separate fields: Street Address, City, and Country
- **Country Dropdown**: Country field provides a complete dropdown list of all valid countries for consistent data entry
- **Smart Parsing**: When editing existing events, the venue string is intelligently parsed to populate the three fields
- **Validation**: At least one address field must be filled when creating or editing an event
- **Automatic Combination**: The three fields automatically combine into a single venue string for storage (e.g., "123 Main St, New York, United States")
- **Auto Location Updates**: User location field automatically updates with countries from their latest 3 events only when:
  - User creates a new event
  - User purchases a ticket (new or resell)
- **"None" Protection**: If user explicitly sets location to "None", the system won't auto-update their location
- **Location-Based Event Filtering**: Events on home page are filtered by user's location countries:
  - If location is "None" or blank: Shows all public events globally
  - If location has countries: Only shows events in those specific countries
  - Applies to regular events list, featured events, and featured grid

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