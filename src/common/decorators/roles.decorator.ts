import { SetMetadata } from '@nestjs/common';
import { RoleEnum } from 'src/modules/auth/dto/auth.dto';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleEnum[]) => SetMetadata(ROLES_KEY, roles);
