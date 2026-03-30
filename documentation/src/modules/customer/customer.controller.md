# `src/modules/customer/customer.controller.ts`

## Role

REST `customer` routes for profile, onboarding, saved places, vehicle category, and home.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/customer` | Profile. |
| POST | `/customer/onboarding` | Complete onboarding. |
| PATCH | `/customer/name` | Update name. |
| POST | `/customer/phone/otp` | OTP for phone change. |
| POST | `/customer/phone/verify` | Verify new phone. |
| POST | `/customer/saved-places` | Create place. |
| GET | `/customer/saved-places` | List places. |
| PATCH | `/customer/saved-places/:id` | Update place. |
| DELETE | `/customer/saved-places/:id` | Delete place. |
| POST | `/customer/vehicle-category` | Set preferred categories. |
| GET | `/customer/home` | Home / fare estimates. |
