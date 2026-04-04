# `src/modules/email/azure-email.service.ts`

## Role

Sends transactional email via **Azure Communication Services** Email API using connection string and sender address from config (`azure.communication`).

## Methods

| Method | Description |
|--------|-------------|
| `sendOtpEmail(email, otp)` | Builds HTML/text OTP message; sends via Azure client. |
