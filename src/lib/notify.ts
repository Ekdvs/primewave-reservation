import { Prisma, NotificationType } from "@/generated/prisma/client";

export async function notify(
  db: Prisma.TransactionClient,
  userIds: string[],
  data: { type: NotificationType; title: string; message: string; reservationId?: string }
) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...data })) });
}

export async function audit(
  db: Prisma.TransactionClient,
  userId: string | null,
  action: string,
  entity: "Reservation" | "Resource",
  entityId: string,
  meta?: Prisma.InputJsonValue
) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, meta } });
}

export async function adminIds(db: Prisma.TransactionClient) {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  return admins.map((a) => a.id);
}