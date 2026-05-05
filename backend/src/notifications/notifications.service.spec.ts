import { PrismaService } from "../common/prisma.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let prisma: {
    $transaction: jest.Mock;
    notification: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
  };
  let domainEvents: {
    emit: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
      notification: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn((input) => Promise.resolve({ id: "notification-1", ...input.data })),
        updateMany: jest.fn()
      },
      user: {
        findMany: jest.fn()
      }
    };
    domainEvents = {
      emit: jest.fn().mockResolvedValue(undefined)
    };

    service = new NotificationsService(
      prisma as unknown as PrismaService,
      domainEvents as unknown as DomainEventsService
    );
  });

  it("dedupes cron reminder notifications for the same day before creating records", async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: "existing-notification" });

    await expect(
      service.handleDomainEvent({
        id: "event-1",
        event: "milestone.due_soon",
        occurredAt: new Date().toISOString(),
        payload: {
          userId: "user-1",
          milestoneName: "Nghiệm thu",
          dueDate: "2026-04-30T00:00:00.000Z",
          projectId: "project-1"
        }
      })
    ).resolves.toEqual([]);

    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          title: "Milestone sắp đến hạn",
          type: "warning",
          link: "/projects/project-1"
        })
      })
    );
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("creates realtime-backed notification records for activity assignment events", async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.handleDomainEvent({
        id: "event-2",
        event: "activity.assigned",
        occurredAt: new Date().toISOString(),
        payload: {
          userId: "user-2",
          activityId: "activity-2",
          activityTitle: "Khảo sát hiện trường"
        }
      })
    ).resolves.toEqual([
      expect.objectContaining({
        userId: "user-2",
        title: "Bạn có hoạt động mới",
        link: "/activities/activity-2"
      })
    ]);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        title: "Bạn có hoạt động mới",
        message: "Hoạt động Khảo sát hiện trường vừa được giao cho bạn.",
        type: "info",
        link: "/activities/activity-2"
      }
    });
  });

  it("emits mention domain events instead of inserting notifications directly", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "staff@ahso.vn"
      }
    ]);

    await service.createMentionNotifications("Nhờ @staff@ahso.vn kiểm tra lại ghi chú.", {
      title: "Bạn được nhắc tới trong ghi chú dự án",
      link: "/projects/project-1"
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(domainEvents.emit).toHaveBeenCalledWith("mention.created", {
      userId: "user-1",
      email: "staff@ahso.vn",
      title: "Bạn được nhắc tới trong ghi chú dự án",
      link: "/projects/project-1"
    });
  });
});
