# Third-party integrations

This folder documents **external services** used by FairDrive API: what they do in this codebase, which **environment variables** configure them (names only—never commit values), and where to find **vendor consoles** and documentation.

## Security

- **Do not** paste production keys, tokens, or connection strings into chat, tickets, or git.
- If secrets were ever exposed, **rotate** them in the vendor dashboard and update deployment secrets only.
- Use a `.env.example` in the repo with **empty or placeholder** values; real values live in your secret store / CI.

## Integration index

| Integration | Doc | Used for |
|-------------|-----|----------|
| Google Maps Platform | [google-maps.md](google-maps.md) | Directions, geocoding, places (via `MapsService` / `FareService`) |
| SSLCommerz | [sslcommerz.md](sslcommerz.md) | Pilot subscription payments, validation API |
| Cashfree | [cashfree.md](cashfree.md) | Aadhaar verification; PG orders (sandbox/test URLs in code paths) |
| SMS (MSG91, Khudebarta, SSL Wireless) | [sms-msg91-khudebarta.md](sms-msg91-khudebarta.md) | OTP SMS for India and Bangladesh |
| Signzy | [signzy.md](signzy.md) | India DL / PAN / RC / DigiLocker Aadhaar APIs |
| Firebase | [firebase.md](firebase.md) | FCM push notifications |
| Microsoft Azure | [azure.md](azure.md) | Blob storage, Computer Vision OCR, OpenAI, Communication Email |

## Webhooks and callbacks (this API)

Payment flows are implemented as **app-invoked HTTPS routes** on FairDrive API (often with JWT), not as vendor POST webhooks to a public URL—see [sslcommerz.md](sslcommerz.md) and [cashfree.md](cashfree.md) for paths under `payment/*`.

## Related code

- Central config mapping: [`src/config/app.config.ts`](../src/config/app.config.md)
- Payment module: [`src/modules/payment/`](../src/modules/payment/payment.service.md)
- Environment template (names only): [`.env.example`](../../.env.example)
