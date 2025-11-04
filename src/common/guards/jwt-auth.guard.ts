import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from 'src/core/cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { RedisKeys } from 'src/core/cache/redis-keys';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {
    this.jwtSecret = this.configService.get<string>('jwt.secret');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.jwtSecret,
      });

      const storedAccessToken = await this.redis.get(
        `${RedisKeys.ACCESS_TOKEN}${payload.userId}`,
      );
      if (!storedAccessToken || storedAccessToken !== token) {
        throw new UnauthorizedException('Token has been invalidated');
      }

      request.user = payload;
      console.log('request.user', request.user);
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
