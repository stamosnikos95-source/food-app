import { IsIn, IsISO8601, IsOptional } from "class-validator";

const STATUSES = ["pending", "confirmed", "ready", "completed", "cancelled"] as const;

export class ListAdminOrdersQuery {
  /** "active" = everything the kitchen still has to act on. */
  @IsOptional()
  @IsIn(["active", ...STATUSES])
  status?: "active" | (typeof STATUSES)[number];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class UpdateOrderStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}

export class ReportRangeQuery {
  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}
