import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("ZodValidationPipe", () => {
  it("throws a Vietnamese validation summary", () => {
    const pipe = new ZodValidationPipe(
      z.object({
        email: z.string().email("Email không hợp lệ")
      })
    );

    expect(() => pipe.transform({ email: "invalid" })).toThrow(BadRequestException);

    try {
      pipe.transform({ email: "invalid" });
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toEqual({
        message: "Dữ liệu không hợp lệ",
        errors: ["email: Email không hợp lệ"]
      });
    }
  });
});
