# Evantic Core

Event Ticket Management System with NFT capabilities

## License

Copyright (C) 2025 Zachary Jordan, Saym Services Inc.  
Licensed under AGPLv3 - See LICENSE file for details

**Attribution Required:** Evantic Core by Saym Services

## Features

- Event creation and management with QR code ticketing
- NFT minting for validated tickets  
- Cryptocurrency payments via Coinbase Commerce
- Stripe payment integration
- P2P ticket validation
- Event reputation system
- Ticket resale mechanism
- 69-day data retention with archiving
- Location-based event filtering
- RSS feed functionality

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up PostgreSQL database
4. Configure environment variables
5. Run: `npm run dev`

## Environment Variables

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `STRIPE_SECRET_KEY` - Stripe API key
- `COINBASE_API_KEY` - Coinbase Commerce API key
- `COINBASE_WEBHOOK_SECRET` - Coinbase webhook secret

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Express.js, TypeScript
- Database: PostgreSQL with Drizzle ORM
- Payment Processing: Stripe, Coinbase Commerce

## Project URL

[evantic.quest](https://evantic.quest)

## Company

Saym Services Inc.  
[saymservices.com](https://saymservices.com)