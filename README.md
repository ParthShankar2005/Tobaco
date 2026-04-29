# TOBACO Distributor + Shopkeeper Platform

Single website with:
- Distributor/Admin dashboard
- Shopkeeper order panel

Data now syncs across devices using Supabase.

## 1) Install and run

```bash
npm install
npm run dev
```

Or use Windows launcher:

```bat
run.bat
```

## 2) Supabase setup (required for multi-device sync)

1. Open Supabase SQL Editor.
2. Run: `supabase/schema.sql`
3. Start the app.

The frontend is already configured to use:
- `https://uddkkxikzzeuwjgwgjba.supabase.co`
- publishable key (anon/public)

You can also override with env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 3) Default login (dev)

- Distributor/Admin:
  - username: `distributor`
  - password: `dist@123`
- Shopkeeper:
  - username: `shopkeeper`
  - password: `shop@123`

## 4) Razorpay setup (online payment)

Frontend env vars:

```env
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
VITE_RAZORPAY_ORDER_ENDPOINT=https://uddkkxikzzeuwjgwgjba.supabase.co/functions/v1/razorpay-order
```

Server-side order creator is included at:
- `supabase/functions/razorpay-order/index.ts`

Deploy function and set secrets (do not put secret in frontend):

```bash
supabase functions deploy razorpay-order --project-ref uddkkxikzzeuwjgwgjba
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx --project-ref uddkkxikzzeuwjgwgjba
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx --project-ref uddkkxikzzeuwjgwgjba
```

The function returns `orderId`/`id` for checkout.

## Notes

- This project currently uses simple username/password rows for quick setup.
- For production security, move authentication to Supabase Auth and tighten RLS policies.
