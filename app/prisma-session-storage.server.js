import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { createPrismaClient } from "./db.server";

const storageOptions = {
  connectionRetries: 1,
  connectionRetryIntervalMs: 10,
};

async function withPrismaSessionStorage(operation) {
  const prisma = createPrismaClient();
  const storage = new PrismaSessionStorage(prisma, storageOptions);

  try {
    return await operation(storage);
  } finally {
    await prisma.$disconnect();
  }
}

export class RequestScopedPrismaSessionStorage {
  isReady() {
    return withPrismaSessionStorage((storage) => storage.isReady());
  }

  storeSession(session) {
    return withPrismaSessionStorage((storage) => storage.storeSession(session));
  }

  loadSession(id) {
    return withPrismaSessionStorage((storage) => storage.loadSession(id));
  }

  deleteSession(id) {
    return withPrismaSessionStorage((storage) => storage.deleteSession(id));
  }

  deleteSessions(ids) {
    return withPrismaSessionStorage((storage) => storage.deleteSessions(ids));
  }

  findSessionsByShop(shop) {
    return withPrismaSessionStorage((storage) =>
      storage.findSessionsByShop(shop),
    );
  }
}
