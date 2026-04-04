# `src/common/interceptors/transform-response.interceptor.ts`

## Role

**Response envelope** interceptor. Wraps successful handler return values as `{ success: true, message, ...rest }`. Skips if headers already sent.

## Class: `TransformResponseInterceptor`

| Method | Description |
|--------|-------------|
| `intercept(context, next)` | `map` operator: destructures `message` from data and spreads the rest; default message `'Request successful'`. |
