import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import {
  CustomFieldDto,
  CustomFieldFilterDto,
  CustomFieldValuesDto,
  UpdateCustomFieldDto
} from "./dto/custom-field.dto";

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: CustomFieldFilterDto) {
    return this.prisma.customField.findMany({
      where: filters.resource
        ? {
            resource: filters.resource
          }
        : undefined,
      orderBy: [{ resource: "asc" }, { order: "asc" }, { label: "asc" }]
    });
  }

  async create(dto: CustomFieldDto) {
    this.validateOptions(dto.type, dto.options);

    return this.prisma.customField.create({
      data: {
        resource: dto.resource,
        name: dto.name,
        label: dto.label,
        type: dto.type,
        options: dto.options ?? undefined,
        required: dto.required ?? false,
        order: dto.order ?? 0
      }
    });
  }

  async update(id: string, dto: UpdateCustomFieldDto) {
    const existing = await this.prisma.customField.findUnique({
      where: {
        id
      }
    });

    if (!existing) {
      throw new NotFoundException("Custom field không tồn tại");
    }

    this.validateOptions(dto.type ?? existing.type, dto.options ?? (existing.options as string[] | undefined));

    return this.prisma.customField.update({
      where: {
        id
      },
      data: {
        resource: dto.resource ?? existing.resource,
        name: dto.name ?? existing.name,
        label: dto.label ?? existing.label,
        type: dto.type ?? existing.type,
        options: dto.options ?? existing.options ?? undefined,
        required: dto.required ?? existing.required,
        order: dto.order ?? existing.order
      }
    });
  }

  async remove(id: string) {
    await this.prisma.customField.delete({
      where: {
        id
      }
    });

    return {
      success: true
    };
  }

  async getValues(resource: "customer" | "project" | "contract", resourceId: string) {
    const values = await this.prisma.customFieldValue.findMany({
      where: {
        resourceId,
        field: {
          resource
        }
      },
      include: {
        field: true
      }
    });

    return values.reduce<Record<string, unknown>>((acc: Record<string, unknown>, item) => {
      acc[item.field.name] = this.parseStoredValue(item.value, item.field.type);
      return acc;
    }, {});
  }

  async saveValues(resource: "customer" | "project" | "contract", resourceId: string, input?: CustomFieldValuesDto) {
    const values = input ?? {};
    const definitions = await this.prisma.customField.findMany({
      where: {
        resource
      },
      orderBy: {
        order: "asc"
      }
    });

    const definitionMap = new Map(definitions.map((field: (typeof definitions)[number]) => [field.name, field]));

    for (const field of definitions) {
      if (field.required && (values[field.name] === undefined || values[field.name] === null || values[field.name] === "")) {
        throw new BadRequestException(`Trường tùy biến "${field.label}" là bắt buộc`);
      }
    }

    const entries = Object.entries(values).filter(([name]) => definitionMap.has(name));

    await this.prisma.$transaction(
      entries.map(([name, value]) => {
        const field = definitionMap.get(name) as (typeof definitions)[number] | undefined;

        if (!field) {
          throw new BadRequestException(`Không tìm thấy cấu hình field ${name}`);
        }

        return this.prisma.customFieldValue.upsert({
          where: {
            fieldId_resourceId: {
              fieldId: field.id,
              resourceId
            }
          },
          create: {
            fieldId: field.id,
            resourceId,
            value: JSON.stringify(value)
          },
          update: {
            value: JSON.stringify(value)
          }
        });
      })
    );
  }

  private validateOptions(type: string, options?: string[]) {
    if ((type === "select" || type === "multiselect") && (!options || options.length === 0)) {
      throw new BadRequestException("Field select hoặc multiselect phải có options");
    }
  }

  private parseStoredValue(raw: string, type: string) {
    try {
      const parsed = JSON.parse(raw);

      if (type === "date" && typeof parsed === "string") {
        return parsed;
      }

      return parsed;
    } catch {
      return raw;
    }
  }
}
