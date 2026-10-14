import { notify } from "@/lib/notify";
import prisma from "@/lib/prisma";

const REMINDER_WINDOW_MIN = 30;

export async function runMaintenance() {
  const now = new Date();

  // 1. Mark finished reservations as COMPLETED
  const completed = await prisma.reservation.updateMany({
    where: {
      status: "CONFIRMED",
      endTime: { lt: now }
    },
    data: {
      status: "COMPLETED"
    },
  });

  // 2. Send reminders for reservations starting soon
  const soon = new Date(now.getTime() + REMINDER_WINDOW_MIN * 60_000);

  const due = await prisma.reservation.findMany({
    where: {
      status: "CONFIRMED",
      reminderSent: false,
      startTime: {
        gt: now,
        lte: soon
      }
    },
    include: {
      resource: {
        select: {
          name: true
        }
      }
    },
  });

  let reminders = 0;

  for (const r of due) {
    await prisma.$transaction(async (tx) => {
      // Claim atomically so concurrent runs don't double-send
      const claim = await tx.reservation.updateMany({
        where: {
          id: r.id,
          reminderSent: false
        },
        data: {
          reminderSent: true
        },
      });
      if (claim.count === 0) return;
      await notify(tx, [r.userId], {
        type: "RESERVATION_REMINDER",
        title: "Upcoming reservation",
        message: `${r.resource.name}: ${r.title} starts at ${r.startTime.toISOString()}.`,
        reservationId: r.id,
      });
      reminders++;
    });
  }

  return { completed: completed.count, reminders };
}