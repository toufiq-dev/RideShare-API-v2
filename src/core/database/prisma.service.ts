import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();

    this.$use(async (params, next) => {
      const result = await next(params);

      const convertDecimalToNumber = (obj: any): any => {
        if (obj instanceof Decimal) {
          return obj.toNumber(); // Use Decimal's toNumber() method
        }
        if (Array.isArray(obj)) {
          return obj.map((item) => convertDecimalToNumber(item));
        }
        if (obj && typeof obj === 'object') {
          return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [
              key,
              convertDecimalToNumber(value),
            ]),
          );
        }
        return obj;
      };

      return convertDecimalToNumber(result);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
