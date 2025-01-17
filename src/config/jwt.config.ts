import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export const getJwtConfig = (
  configService: ConfigService,
): JwtModuleOptions => {
  const secret = configService.get<string>('jwt.secret');

  if (!secret) {
    throw new Error('JWT secret is not configured');
  }

  return {
    secret,
    signOptions: {
      expiresIn: configService.get<string>('jwt.accessTokenExpiresIn'),
    },
  };
};
