import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@food-app/shared-types";
import { RolesGuard } from "./roles.guard";

const contextFor = (role: Role) =>
  ({ getHandler: () => null, getClass: () => null,
     switchToHttp: () => ({ getRequest: () => ({ user: { id: "u", email: "e", role } }) }) }) as unknown as ExecutionContext;

describe("RolesGuard", () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector & { getAllAndOverride: jest.Mock };
  const guard = new RolesGuard(reflector);

  it("lets through routes without role requirements", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextFor(Role.CUSTOMER))).toBe(true);
  });
  it("allows listed roles and blocks everyone else", () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.STAFF]);
    expect(guard.canActivate(contextFor(Role.STAFF))).toBe(true);
    expect(guard.canActivate(contextFor(Role.CUSTOMER))).toBe(false);
  });
  it("keeps menu edits admin-only", () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(contextFor(Role.STAFF))).toBe(false);
  });
});
