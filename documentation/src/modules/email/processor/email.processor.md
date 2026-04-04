# `src/modules/email/processor/email.processor.ts`

## Role

**BullMQ worker** for queue `otp-email`: consumes `send-otp` jobs and invokes `EmailService._sendOtpEmail` (or equivalent) asynchronously.

## Notes

- Ensures API responds quickly while email sends in background.
