import { SetMetadata } from "@nestjs/common";
import { Role } from "@food-app/shared-types";

export const ROLES_KEY = "roles";

/**
 * Usage: @Roles(Role.ADMIN, Role.STAFF) on a controller method.
 * Combine with JwtAuthGuard + RolesGuard.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
