import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain ?? ""}`;
}

/**
 * Grants the admin role to the accounts listed in ADMIN_EMAILS at startup.
 * Only ever list emails whose accounts ALREADY exist: there is no email
 * verification yet, so a listed-but-unregistered address could be claimed
 * by whoever registers it first. Missing accounts are skipped and logged.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const emails = (this.config.get<string>("ADMIN_EMAILS") ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    for (const email of emails) {
      // Exact match on the normalized address. A case-insensitive search could
      // pick a look-alike account ("Owner@…") registered by someone else.
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        this.logger.warn(`ADMIN_EMAILS: no account for ${maskEmail(email)}; skipped`);
        continue;
      }
      if (user.role !== "admin") {
        await this.prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
        this.logger.log(`Granted admin role to ${maskEmail(email)}`);
      }
    }
  }
}
