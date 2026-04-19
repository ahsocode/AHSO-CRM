import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { JwtUser, isStaff } from "../auth/auth.types";
import { CustomersService } from "../customers/customers.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService
  ) {}

  async findByCustomer(customerId: string, user: JwtUser) {
    await this.customersService.assertCustomerAccess(customerId, user);

    const contacts = await this.prisma.contact.findMany({
      where: {
        customerId
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
    });

    return contacts;
  }

  async create(customerId: string, dto: CreateContactDto, user: JwtUser) {
    await this.customersService.assertCustomerAccess(customerId, user);

    if (dto.isPrimary) {
      await this.clearPrimaryContacts(customerId);
    }

    const contact = await this.prisma.contact.create({
      data: {
        ...dto,
        customerId
      }
    });

    return contact;
  }

  async update(id: string, dto: UpdateContactDto, user: JwtUser) {
    const contact = await this.findAccessibleContact(id, user);

    if (dto.isPrimary) {
      await this.clearPrimaryContacts(contact.customerId);
    }

    return this.prisma.contact.update({
      where: {
        id
      },
      data: dto
    });
  }

  async remove(id: string, user: JwtUser) {
    await this.findAccessibleContact(id, user);

    await this.prisma.contact.delete({
      where: {
        id
      }
    });

    return {
      success: true
    };
  }

  private async clearPrimaryContacts(customerId: string) {
    await this.prisma.contact.updateMany({
      where: {
        customerId,
        isPrimary: true
      },
      data: {
        isPrimary: false
      }
    });
  }

  private async findAccessibleContact(id: string, user: JwtUser) {
    const contact = await this.prisma.contact.findUnique({
      where: {
        id
      },
      include: {
        customer: {
          select: {
            id: true,
            assignedToId: true,
            deletedAt: true
          }
        }
      }
    });

    if (!contact || contact.customer.deletedAt) {
      throw new NotFoundException("Không tìm thấy đầu mối liên hệ");
    }

    if (isStaff(user) && contact.customer.assignedToId !== user.sub) {
      throw new ForbiddenException("Bạn không có quyền thao tác liên hệ này");
    }

    return contact;
  }
}
