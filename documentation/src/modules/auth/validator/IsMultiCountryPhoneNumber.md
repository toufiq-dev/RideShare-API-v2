# `src/modules/auth/validator/IsMultiCountryPhoneNumber.ts`

## Role

**class-validator** custom decorator: validates phone numbers against any of a list of ISO country codes using `libphonenumber-js` `isValidPhoneNumber`.

## Function factory

| Export | Description |
|--------|-------------|
| `IsMultiCountryPhoneNumber(allowedCountries, validationOptions?)` | `registerDecorator` with `validate` that returns true if **any** country in `allowedCountries` validates the value; default message lists allowed countries. |
