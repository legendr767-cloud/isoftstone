import { schema, type Db, type Tx } from '../db/index.js';

type Executor = Db | Tx;
export async function audit(
  ex: Executor,
  entry: { actorId?: string | null; action: string; entityType: string; entityId?: string | null; detail?: unknown; ip?: string | null },
) {
  await ex.insert(schema.auditLogs).values({
    actorId: entry.actorId ?? null, action: entry.action, entityType: entry.entityType,
    entityId: entry.entityId ?? null, detail: (entry.detail ?? null) as never, ip: entry.ip ?? null,
  });
}

export async function notify(ex: Executor, userId: string, title: string, body: string) {
  await ex.insert(schema.notifications).values({ userId, title, body });
}
