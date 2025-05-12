import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { CountryCode, isValidPhoneNumber } from 'libphonenumber-js';

export function IsMultiCountryPhoneNumber(
  allowedCountries: string[],
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isMultiCountryPhoneNumber',
      target: object.constructor,
      propertyName,
      constraints: [allowedCountries],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [countries] = args.constraints;
          return countries.some((country: CountryCode) =>
            isValidPhoneNumber(value, country),
          );
        },
        defaultMessage(args: ValidationArguments) {
          const [countries] = args.constraints;
          return `Phone number must be valid for one of the following countries: ${countries.join(
            ', ',
          )}`;
        },
      },
    });
  };
}
