import { PrismaClient, ActivityType, ContractStatus, CustomerStatus, Priority, ProjectStatus, QuoteStatus, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

function monthOffset(months: number, day = 10) {
  const date = new Date();
  date.setMonth(date.getMonth() + months, day);
  date.setHours(9, 0, 0, 0);
  return date;
}

async function main() {
  await prisma.payment.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.project.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("AHSO123!", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@ahso.vn",
      name: "Nguyễn Minh Quân",
      password: hashedPassword,
      role: Role.ADMIN,
      isActive: true
    }
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@ahso.vn",
      name: "Trần Đức Nam",
      password: hashedPassword,
      role: Role.MANAGER,
      isActive: true
    }
  });

  const vinamilk = await prisma.customer.create({
    data: {
      name: "Vinamilk Corporation",
      shortName: "VPC",
      taxCode: "0300588569",
      industry: "Thực phẩm & Đồ uống",
      address: "Số 10 Tân Trào, Quận 7, TP.HCM",
      website: "https://www.vinamilk.com.vn",
      phone: "02854155555",
      email: "purchasing@vinamilk.vn",
      source: "referral",
      notes: "Đối tác chiến lược, ưu tiên phản hồi trong 24h.",
      status: CustomerStatus.ACTIVE,
      isVip: true,
      assignedToId: admin.id,
      contacts: {
        create: [
          {
            name: "Lê Khánh An",
            title: "Trưởng phòng mua hàng",
            email: "an.lk@vinamilk.vn",
            phone: "0909123456",
            isPrimary: true
          }
        ]
      }
    }
  });

  const thaco = await prisma.customer.create({
    data: {
      name: "Thaco Industries",
      shortName: "THI",
      taxCode: "4000811952",
      industry: "Cơ khí & Ô tô",
      address: "KCN Chu Lai, Quảng Nam",
      website: "https://www.thacoindustries.com",
      phone: "02353868888",
      email: "automation@thaco.com.vn",
      source: "exhibition",
      status: CustomerStatus.PROSPECT,
      assignedToId: manager.id
    }
  });

  const choRay = await prisma.customer.create({
    data: {
      name: "Bệnh viện Chợ Rẫy",
      shortName: "CRH",
      industry: "Y tế",
      address: "201B Nguyễn Chí Thanh, Quận 5, TP.HCM",
      phone: "02838554137",
      email: "vat-tu@choray.vn",
      source: "website",
      status: CustomerStatus.ACTIVE,
      assignedToId: admin.id
    }
  });

  const dnp = await prisma.customer.create({
    data: {
      name: "DNP Water",
      shortName: "DNP",
      industry: "Hạ tầng nước",
      address: "Hà Nội",
      phone: "02432001111",
      email: "projects@dnpwater.vn",
      source: "cold-call",
      status: CustomerStatus.LEAD,
      assignedToId: manager.id
    }
  });

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        code: "AHSO-294",
        name: "Cảm biến áp suất lò hơi",
        status: ProjectStatus.SURVEY,
        priority: Priority.NORMAL,
        estimatedValue: 85000000,
        startDate: monthOffset(0, 2),
        expectedEndDate: monthOffset(1, 20),
        customerId: vinamilk.id,
        notes: "Khảo sát hệ thống cũ và chốt điểm lắp đặt."
      }
    }),
    prisma.project.create({
      data: {
        code: "AHSO-295",
        name: "Kiểm tra tủ điện tầng 4",
        status: ProjectStatus.SURVEY,
        priority: Priority.HIGH,
        estimatedValue: 15000000,
        startDate: monthOffset(0, 5),
        expectedEndDate: monthOffset(0, 28),
        customerId: choRay.id
      }
    }),
    prisma.project.create({
      data: {
        code: "AHSO-301",
        name: "SCADA dây chuyền đóng gói",
        status: ProjectStatus.QUOTING,
        priority: Priority.HIGH,
        estimatedValue: 420000000,
        startDate: monthOffset(-1, 8),
        expectedEndDate: monthOffset(1, 12),
        customerId: thaco.id
      }
    }),
    prisma.project.create({
      data: {
        code: "AHSO-305",
        name: "Nâng cấp hệ thống PLC trạm bơm",
        status: ProjectStatus.NEGOTIATING,
        priority: Priority.NORMAL,
        estimatedValue: 260000000,
        startDate: monthOffset(-1, 15),
        expectedEndDate: monthOffset(2, 6),
        customerId: dnp.id
      }
    }),
    prisma.project.create({
      data: {
        code: "AHSO-287",
        name: "Tích hợp giám sát năng lượng",
        status: ProjectStatus.DELIVERING,
        priority: Priority.NORMAL,
        estimatedValue: 560000000,
        startDate: monthOffset(-3, 10),
        expectedEndDate: monthOffset(1, 18),
        customerId: vinamilk.id
      }
    }),
    prisma.project.create({
      data: {
        code: "AHSO-266",
        name: "Hệ thống băng tải kiểm định",
        status: ProjectStatus.COMPLETED,
        priority: Priority.LOW,
        estimatedValue: 310000000,
        startDate: monthOffset(-5, 5),
        expectedEndDate: monthOffset(-1, 20),
        customerId: thaco.id
      }
    })
  ]);

  const quotingProject = projects[2];
  const negotiatingProject = projects[3];
  const deliveringProject = projects[4];
  const completedProject = projects[5];

  await prisma.quote.create({
    data: {
      quoteNo: "BG-2026-001",
      version: 1,
      status: QuoteStatus.DRAFT,
      validUntil: monthOffset(1, 30),
      subtotal: 420000000,
      taxRate: 10,
      taxAmount: 42000000,
      total: 462000000,
      terms: "Thanh toán 50% khi ký, 50% khi nghiệm thu.",
      deliveryTerms: "Giao hàng trong 21 ngày kể từ PO.",
      projectId: quotingProject.id,
      createdById: admin.id,
      items: {
        create: [
          {
            order: 1,
            name: "Tủ điều khiển trung tâm",
            quantity: 1,
            unit: "Bộ",
            unitPrice: 180000000,
            total: 180000000
          },
          {
            order: 2,
            name: "Phần mềm SCADA",
            quantity: 1,
            unit: "Gói",
            unitPrice: 240000000,
            total: 240000000
          }
        ]
      }
    }
  });

  await prisma.quote.create({
    data: {
      quoteNo: "BG-2026-002",
      version: 1,
      status: QuoteStatus.SENT,
      validUntil: monthOffset(0, 25),
      subtotal: 260000000,
      taxRate: 10,
      taxAmount: 26000000,
      total: 286000000,
      terms: "Thanh toán theo tiến độ 3 đợt.",
      deliveryTerms: "Theo tiến độ khảo sát hiện trường.",
      sentAt: monthOffset(0, 6),
      projectId: negotiatingProject.id,
      createdById: manager.id,
      items: {
        create: [
          {
            order: 1,
            name: "PLC Siemens S7-1500",
            quantity: 2,
            unit: "Bộ",
            unitPrice: 65000000,
            total: 130000000
          },
          {
            order: 2,
            name: "Tích hợp hệ thống",
            quantity: 1,
            unit: "Gói",
            unitPrice: 130000000,
            total: 130000000
          }
        ]
      }
    }
  });

  await prisma.quote.create({
    data: {
      quoteNo: "BG-2026-003",
      version: 2,
      status: QuoteStatus.ACCEPTED,
      validUntil: monthOffset(-2, 28),
      subtotal: 560000000,
      taxRate: 10,
      taxAmount: 56000000,
      total: 616000000,
      terms: "Thanh toán 40/40/20.",
      deliveryTerms: "Triển khai trong 45 ngày.",
      sentAt: monthOffset(-3, 12),
      acceptedAt: monthOffset(-3, 20),
      projectId: deliveringProject.id,
      createdById: admin.id,
      items: {
        create: [
          {
            order: 1,
            name: "Thiết bị đo năng lượng",
            quantity: 8,
            unit: "Cái",
            unitPrice: 35000000,
            total: 280000000
          },
          {
            order: 2,
            name: "Dịch vụ tích hợp",
            quantity: 1,
            unit: "Gói",
            unitPrice: 280000000,
            total: 280000000
          }
        ]
      }
    }
  });

  const contractDelivering = await prisma.contract.create({
    data: {
      contractNo: "HD-2026-002",
      signDate: monthOffset(-3, 25),
      startDate: monthOffset(-3, 28),
      endDate: monthOffset(1, 15),
      value: 616000000,
      status: ContractStatus.ACTIVE,
      projectId: deliveringProject.id,
      notes: "Ưu tiên nghiệm thu từng phân hệ."
    }
  });

  const contractCompleted = await prisma.contract.create({
    data: {
      contractNo: "HD-2025-019",
      signDate: monthOffset(-6, 12),
      startDate: monthOffset(-6, 15),
      endDate: monthOffset(-1, 22),
      value: 341000000,
      status: ContractStatus.COMPLETED,
      projectId: completedProject.id
    }
  });

  await prisma.milestone.createMany({
    data: [
      {
        name: "Khảo sát hiện trường",
        status: "DONE",
        projectId: deliveringProject.id,
        contractId: contractDelivering.id,
        paymentAmount: 184800000,
        completedAt: monthOffset(-3, 30)
      },
      {
        name: "Lắp đặt tủ điện",
        status: "IN_PROGRESS",
        projectId: deliveringProject.id,
        contractId: contractDelivering.id,
        paymentAmount: 246400000,
        dueDate: monthOffset(0, 28)
      },
      {
        name: "Nghiệm thu cuối",
        status: "PENDING",
        projectId: deliveringProject.id,
        contractId: contractDelivering.id,
        paymentAmount: 184800000,
        dueDate: monthOffset(1, 15)
      }
    ]
  });

  await prisma.payment.createMany({
    data: [
      {
        amount: 80000000,
        paidAt: monthOffset(-5, 18),
        method: "Chuyển khoản",
        reference: "UNC-2401",
        contractId: contractCompleted.id
      },
      {
        amount: 120000000,
        paidAt: monthOffset(-4, 20),
        method: "Chuyển khoản",
        reference: "UNC-2410",
        contractId: contractCompleted.id
      },
      {
        amount: 141000000,
        paidAt: monthOffset(-1, 12),
        method: "Chuyển khoản",
        reference: "UNC-2491",
        contractId: contractCompleted.id
      },
      {
        amount: 184800000,
        paidAt: monthOffset(-2, 25),
        method: "Chuyển khoản",
        reference: "UNC-2520",
        contractId: contractDelivering.id
      },
      {
        amount: 123200000,
        paidAt: monthOffset(0, 8),
        method: "Chuyển khoản",
        reference: "UNC-2608",
        contractId: contractDelivering.id
      }
    ]
  });

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0, 0);
  const endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30, 0, 0);

  await prisma.activity.createMany({
    data: [
      {
        type: ActivityType.MEETING,
        title: "Họp xác nhận layout tủ điều khiển",
        content: "Cần chốt kích thước cửa tủ trước khi đặt hàng.",
        scheduledAt: startToday,
        isCompleted: false,
        customerId: vinamilk.id,
        projectId: deliveringProject.id,
        userId: admin.id
      },
      {
        type: ActivityType.FOLLOWUP,
        title: "Theo dõi phản hồi báo giá BG-2026-002",
        content: "Khách hàng yêu cầu phương án thay thế PLC.",
        scheduledAt: endToday,
        isCompleted: false,
        customerId: dnp.id,
        projectId: negotiatingProject.id,
        userId: manager.id
      },
      {
        type: ActivityType.CALL,
        title: "Gọi điện chốt lịch khảo sát",
        content: "Đã xác nhận đội kỹ thuật đến lúc 8h30.",
        doneAt: monthOffset(0, 4),
        isCompleted: true,
        customerId: choRay.id,
        projectId: projects[1].id,
        userId: admin.id
      },
      {
        type: ActivityType.NOTE,
        title: "Cập nhật tiến độ hợp đồng HD-2026-002",
        content: "Nhà máy yêu cầu dời lịch nghiệm thu sang tuần sau.",
        doneAt: monthOffset(0, 7),
        isCompleted: true,
        customerId: vinamilk.id,
        projectId: deliveringProject.id,
        userId: admin.id
      },
      {
        type: ActivityType.EMAIL,
        title: "Gửi hồ sơ năng lực cho Thaco",
        content: "Đã gửi profile dự án tương tự cho phòng mua hàng.",
        doneAt: monthOffset(-1, 24),
        isCompleted: true,
        customerId: thaco.id,
        projectId: quotingProject.id,
        userId: manager.id
      }
    ]
  });

  console.log("Seed dữ liệu AHSO CRM thành công.");
  console.log("Tài khoản đăng nhập dev: admin@ahso.vn / AHSO123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

