import { PrismaClient } from "@repo/db";

interface AugmentedGlobal {
  ___prisma?: PrismaClient;
}

declare const global: AugmentedGlobal;

export default function getPrisma(): PrismaClient {
  if (!global.___prisma) {
    global.___prisma = new PrismaClient();
  }

  return global.___prisma;
}
