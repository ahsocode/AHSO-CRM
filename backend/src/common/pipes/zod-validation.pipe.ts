import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(
    private readonly schema: ZodSchema<T>,
    private readonly source = "body"
  ) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : this.source;
        return `${path}: ${issue.message}`;
      });

      throw new BadRequestException({
        message: "Validation failed",
        errors
      });
    }

    return result.data;
  }
}

