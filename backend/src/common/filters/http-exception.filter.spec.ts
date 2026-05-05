import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

function createHost() {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response
    })
  } as any;

  return { host, response };
}

describe("HttpExceptionFilter", () => {
  const filter = new HttpExceptionFilter();

  it("translates common NestJS default messages to Vietnamese", () => {
    const { host, response } = createHost();

    filter.catch(new UnauthorizedException(), host);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 401,
      message: "Chưa đăng nhập hoặc phiên đã hết hạn",
      errors: ["Chưa đăng nhập hoặc phiên đã hết hạn"]
    });
  });

  it("keeps detailed validation errors while using a Vietnamese summary", () => {
    const { host, response } = createHost();

    filter.catch(
      new BadRequestException({
        message: "Validation failed",
        errors: ["email: Email không hợp lệ"]
      }),
      host
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: "Dữ liệu không hợp lệ",
      errors: ["email: Email không hợp lệ"]
    });
  });
});
