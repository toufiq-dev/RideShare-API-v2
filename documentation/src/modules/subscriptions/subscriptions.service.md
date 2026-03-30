# `src/modules/subscriptions/subscriptions.service.ts`

## Role

**Subscription catalog** CRUD for pilot subscription products (`Subscription` model): list with numeric coercion, create/update types.

## Methods

| Method | Description |
|--------|-------------|
| `getSubscriptionTypes` | `findMany` ordered by `serialNumber`; normalizes Decimal fields to numbers. |
| `createSubscriptionType` | Creates subscription row. |
| `updateSubscriptionType` | Updates by id. |

## Notes

- Purchase flow is in **PaymentService**; this module manages catalog metadata.
