# `src/modules/email/email.service.ts`

## Role

**Email OTP**: enqueue job on Bull queue `otp-email`, store OTP in Redis (`EMAIL_VERIFICATION_OTP`), send via **Azure Communication** first, fallback to **Nodemailer** SMTP; verify email flow.

## Methods

| Method | Description |
|--------|-------------|
| `sendOtpEmail` | Rate limit via Redis; `otpQueue.add('send-otp', { sendOtpDto })`. |
| `_sendOtpEmail` | Worker implementation: random OTP, Redis, Azure vs SMTP send. |
| `verifyEmail` | Compares submitted OTP against Redis. |

## Dependencies

`ConfigService`, `PrismaService`, `RedisService`, `otp-email` Bull queue, `AzureEmailService`.
