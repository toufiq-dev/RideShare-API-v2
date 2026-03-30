# `src/modules/payment/payment.service.ts`

## Role

**Payments** for pilot subscriptions and related flows: **SSLCommerz** init/validation/callback handling, **Cashfree** order creation where configured, transaction rows in Prisma, wallet credit logic, idempotent `tranId` generation, and reconciliation helpers.

## Representative methods

| Method | Description |
|--------|-------------|
| `initSslcommerzSubscription` | Builds order from subscription + pilot + coupon; persists `Transaction`; returns gateway redirect payload. |
| `sslcommerzCallback` / `verifyPayment` | Validates SSLCommerz IPN/callback; updates transaction and wallet. |
| Other methods | Failure handling, refunds (if present), test client flows — see source. |

## Config keys

`sslcommerz.*`, `cashfreePayment.*` from `app.config.ts`.
