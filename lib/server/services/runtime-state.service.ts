import { Prisma } from "@prisma/client";

import { prisma } from "./prisma.service";

class RuntimeStateService {
  async get<T>(key: string): Promise<T | null> {
    const row = await prisma.runtimeState.findUnique({
      where: { key }
    });

    return row ? (row.value as T) : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    const jsonValue = toPrismaJson(value);

    await prisma.runtimeState.upsert({
      where: { key },
      create: {
        key,
        value: jsonValue
      },
      update: {
        value: jsonValue
      }
    });
  }
}

const toPrismaJson = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

export const runtimeStateService = new RuntimeStateService();
