# `src/modules/payment/payment.controller.ts`

## Role

HTTP endpoints for initiating SSLCommerz/Cashfree payments, callbacks (often public with signature validation), and verification routes.

## Notes

- Check each handler for `@Public` or guards; callback URLs must match SSLCommerz dashboard settings.
