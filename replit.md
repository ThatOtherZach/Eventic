# Event Ticket Management System

## Overview
This is a full-stack event ticketing application built with React and Express.js. It enables users to create and manage events, generate tickets, and validate them via QR codes. The system provides a complete event management workflow with a modern web interface, robust backend API, comprehensive error logging, and Bootstrap-style user notifications. It includes features like location-based routing, a unified event form, smart event sorting, and a simplified image system. Advanced functionalities include P2P ticket validation, an event reputation system, a ticket resale mechanism, and NFT minting for validated tickets. The system implements a 69-day data retention policy with automated archiving and a comprehensive role-based access control (RBAC) system for managing user permissions. The interface features subtle Windows 98-inspired styling for a nostalgic touch.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Updates
- **Admin Credit Claim Feature (2025-09-12)**: Replaced admin allowance with dedicated admin claim button giving 250 credits once per 24 hours. Only visible to users with super_admin or event_moderator roles. Admin claims tracked separately from regular daily claims.
- **Fixed Timezone Validation Bug (2025-09-11)**: Resolved critical issue where events in non-UTC timezones (especially Mountain Time) were incorrectly validating tickets. Solution: Added UTC timestamp columns (startAtUtc, endAtUtc) to events table, converting local times to UTC on save. Validation now uses simple UTC comparisons instead of complex runtime timezone parsing.

## System Architecture

### Frontend Architecture
The client uses React with TypeScript and Vite. It leverages shadcn/ui components built on Radix UI, styled with Tailwind CSS. Key aspects include wouter for routing, TanStack Query for server state management, and React Hook Form with Zod for form handling.

### Backend Architecture
The server is built with Express.js and TypeScript, following a RESTful API design. It features a configurable storage interface (MemStorage), custom logging middleware, and centralized error handling.

### Data Layer
The application uses Drizzle ORM with PostgreSQL for database operations. It defines a centralized schema, generates TypeScript types from the schema, and uses Zod for runtime data validation. Connection is established via Neon serverless PostgreSQL.

### Development Environment
The project is configured for seamless development using Vite dev server (with HMR), ESBuild for server bundling, and TypeScript for strict type checking. Path aliases (`@/`, `@shared/`) are used for clean imports.

### QR Code System
The system includes client-side QR code generation for tickets and server-side validation through QR data lookup, complemented by a web-based QR scanner interface.

### Key Features & Design Decisions
- **Role-Based Access Control (RBAC)**: Comprehensive permission system with four user roles (Super Admin, Event Moderator, Support, User) and granular permissions (manage_events, manage_users, manage_settings, view_analytics, manage_payments). Replaces hardcoded email domain checks with proper permission-based authorization. Super Admin role automatically assigned to @saymservices.com users during migration.
- **Location-Based Routing**: Dynamic URL routing for filtering events by city/country (/NewYork, /UnitedStates), with automatic space conversion and visual effects (Golden Ticket, Monthly Colors). Includes RSS feed functionality for location-based event subscriptions.
- **Unified Event Form**: A single `event-form.tsx` for creation and editing, intelligently detecting mode and validating ownership.
- **Smart Event Sorting**: Home page displays active events only, prioritizing those within the next 24 hours, then chronologically.
- **Simplified Location & Image Systems**: Single country selection for user preference, and a single featured image for events serving as ticket background. Supports JPEG, JPG, PNG, and GIF formats (max 5MB).
- **P2P Validation**: Optional setting allowing any ticket holder to validate others' tickets for the same event, enabled only at event creation.
- **Event Reputation System**: Attendees can rate events (thumbs up/down); event owners' reputation is displayed with badges and formatted vote counts. Users earn 1 ticket reward when rating an event for the first time.
- **Ticket Resale System**: Replaces refunds, allowing tickets to be resold at original price (2% fee for paid tickets). Resale queue ensures automatic matching with new purchases.
- **NFT Royalty System**: Users can choose between standard minting (12 tickets) with 2.69% royalty on resales or no-royalty minting (15 tickets). Implements ERC-2981 royalty standard for marketplace compatibility.
- **User-Controlled NFT Minting**: Platform charges tickets (12 or 15) for NFT minting rights, but users pay gas fees directly from their wallets. Users connect MetaMask or Coinbase Wallet, approve the transaction, and the NFT is minted directly to their address. Transaction monitoring ensures successful mints or automatic ticket refunds on failure. Gas costs on Base L2 are typically $0.01-$0.50 per mint.
- **Error Logging**: Comprehensive server error logging to a `system_logs` table with 90-day retention, categorizing errors by severity.
- **Toast Notifications**: Bootstrap-style success, error, and system fault toasts for immediate visual feedback.
- **Enhanced Event Management**: Date/time validation for event starts/ends, supporting multi-day events.
- **Production Readiness**: Robust date handling, resilient authentication (JWKS), schema optimization, rate limiting on key actions, and Zod validation.
- **Venue Address System**: Separate fields for Street, City, Country, with a country dropdown. Intelligent parsing for existing events and automatic combination for storage. User location preference updates automatically based on event activity.
- **Event Creation Rules**: Events must be scheduled at least 3 hours in advance, with real-time validation feedback showing hours until event start.
- **Data Retention Policy**: Events and tickets are automatically archived 69 days after the event ends (or start date if no end date). For recurring events, the system creates the next occurrence before archiving the old instance. NFT-minted tickets have their metadata permanently preserved in the Registry table, allowing the original event and ticket records to be safely archived. Archived data is preserved in CSV format for historical records. A deletion countdown is displayed on event detail and ticket view pages when events have ended, showing users how many days remain before the data is removed. Crypto payment intents follow the same 69-day retention policy and are deleted when events are archived.
- **Account Deletion System**: Users can schedule account deletion with a 90-day grace period. During this period, they cannot create new events but can cancel deletion at any time. After 90 days, the system anonymizes financial/audit records (replacing user IDs with `username_deleted_MMDDYYYY`) while completely deleting personal data. NFT registry records are never touched. Anonymized records preserve platform economics and audit trails without personal information.
- **Economic Model Philosophy**: The platform uses "tickets" as action points with gentle inflation designed to reward good actors and discourage malicious behavior. Event creation costs tickets (equal to capacity), while attendance is free. Rating system: thumbs up earns +1 ticket (one-time), thumbs down costs -1 ticket (one-time), switching ratings is free. Surge pricing uses logarithmic scaling for demand (max 25% increase) and gentle time-based urgency (25%/13%/5%/2% for last day/3 days/week/2 weeks). This creates subtle economic friction that makes bad behavior slightly costly while rewarding community builders with reputation discounts and easier platform use.
- **Crypto Payment Processing**: Events can accept Bitcoin, Ethereum, or USDC payments with wallet addresses. System tracks payment intents with unique references for transaction matching. Event owners can export payment data as CSV for accounting. Terminal-style display shows wallet information and payment status. Payment intents follow the 69-day retention policy and are archived with event data.

## External Dependencies

### Core Framework Dependencies
- `@neondatabase/serverless`: Serverless PostgreSQL driver
- `drizzle-orm`: Type-safe ORM
- `drizzle-kit`: Database migrations and schema management
- `express`: Node.js web framework

### Frontend UI Dependencies
- `@radix-ui/*`: Accessible UI primitives
- `@tanstack/react-query`: Server state management
- `react-hook-form`: Form management
- `wouter`: React routing library
- `tailwindcss`: CSS framework
- `class-variance-authority`: Component styling

### Development and Build Tools
- `vite`: Build tool and dev server
- `tsx`: TypeScript execution environment
- `esbuild`: JavaScript bundler
- `@replit/vite-plugin-runtime-error-modal`: Replit error handling
- `@replit/vite-plugin-cartographer`: Replit development tooling

### Utility Libraries
- `zod`: Schema validation
- `date-fns`: Date utility library
- `clsx`: Conditional className construction
- `cmdk`: Command menu
- `embla-carousel-react`: Carousel component