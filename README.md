# TOBACO Distribution Platform

Full B2B ordering platform for tobacco distribution with:
- Distributor admin panel
- Shopkeeper ordering panel
- Shared order/bill workflow
- Supabase cloud sync
- Razorpay online payment checkout

## What This Project Does

The app manages the full cycle:
1. Distributor manages items, shops, user accounts, prices, and offers.
2. Shopkeeper creates orders (cash or online).
3. Distributor accepts/rejects orders and prints/downloads bills.
4. Both sides get role-specific notifications and order history.

## Main Modules

- `Distributor/DistributorPanel.tsx`
  - Dashboard, Items, Users, Shops, Orders, Bills, Order Sheets
  - Item add/edit/delete with image and item number
  - Shop add popup and delete with access-key confirmation
  - Shop-wise custom pricing and offer text

- `Shopkeeper/ShopkeeperPanel.tsx`
  - Item cards with search and per-shop pricing
  - Order creation (cash/online)
  - Cancel pending order from shopkeeper side
  - My Orders with bill download

- `TobacoLayout.tsx`
  - Sidebar, profile menu, notification bell
  - Role-based navigation

- `state.tsx`
  - Central app state
  - Supabase sync and fallback handling
  - Order ID generation, retention cleanup, and metadata

- `src/auth/roleAuth.tsx`
  - Role login/session management
  - Distributor and shopkeeper account control
  - Session role-switch protection (prevents wrong panel after back/forward)

## Key Features Implemented

- Single portal entry page (`/`) with Distributor and Shopkeeper access.
- Separate login routes:
  - `/admin-login`
  - `/shopkeeper-login`
- Shopkeeper and distributor share same order database.
- Order status notifications with cancellation source tracking:
  - `Cancelled by Distributor`
  - `Cancelled by Shopkeeper`
- Bill download/print from distributor and shopkeeper order history.
- Order retention cleanup for old records (30-day policy in state logic).

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (`@supabase/supabase-js`)
- Razorpay Checkout
- Recharts for trends/charts

## Local Setup

### Prerequisites

- Node.js 18+
- npm

### Install and run

```bash
npm install
npm run dev
```

Or use Windows launcher:

```bat
run.bat
```

## Environment Variables

Create `.env.local` in project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
VITE_RAZORPAY_ORDER_ENDPOINT=https://<project-ref>.supabase.co/functions/v1/razorpay-order
```

Do not commit secrets or private keys.

## Supabase Setup

1. Open Supabase SQL Editor.
2. Run schema file:
   - `supabase/schema.sql`
3. Verify tables are created:
   - `products`, `shops`, `price_rules`, `orders`, `order_items`, `admin_auth`, `shopkeeper_accounts`, `user_profiles`

## Razorpay Setup

Frontend uses `VITE_RAZORPAY_KEY_ID`.
Backend order creation uses Supabase Edge Function:

- Function file: `supabase/functions/razorpay-order/index.ts`

Deploy and set secrets:

```bash
supabase functions deploy razorpay-order --project-ref <project-ref>
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx --project-ref <project-ref>
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx --project-ref <project-ref>
```

If checkout does not open, first confirm function endpoint returns `200` and not `404`.

## Default Dev Credentials

- Distributor
  - username: `distributor`
  - password: `dist@123`

- Shopkeeper
  - username: `shopkeeper`
  - password: `shop@123`

## Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run preview` - preview built app
- `npm run lint` - run ESLint

## Deployment (Vercel)

### Recommended build settings

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

### Important

`node_modules/`, `dist/`, and `.env.local` must not be tracked in git.
This repo includes `.gitignore` for that.

## Troubleshooting

### 1) Vercel build error: `vite: Permission denied`

Cause:
- `node_modules` committed in repo.

Fix:
- Ensure `node_modules` is untracked.
- Commit `.gitignore`.
- Redeploy with cleared cache once.

### 2) Razorpay page not opening

Check:
- `VITE_RAZORPAY_KEY_ID` set.
- `VITE_RAZORPAY_ORDER_ENDPOINT` correct.
- Edge function deployed and secrets present.
- Endpoint not returning `404/401`.

### 3) Wrong panel opens after browser back/forward

Handled in login flow:
- mismatched role session is auto-cleared before showing target login page.

## Security Notes

- Current auth is lightweight for operational speed.
- For production hardening:
  - move to Supabase Auth
  - tighten RLS policies
  - rotate leaked keys immediately
  - add server-side validation/audit logging
