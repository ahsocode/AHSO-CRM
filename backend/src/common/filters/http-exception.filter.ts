import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

const DEFAULT_HTTP_ERROR_MESSAGE = "Yêu cầu không thành công";

const ERROR_MESSAGE_TRANSLATIONS: Record<string, string> = {
  "Validation failed": "Dữ liệu không hợp lệ",
  "Bad Request": "Yêu cầu không hợp lệ",
  Unauthorized: "Chưa đăng nhập hoặc phiên đã hết hạn",
  "Forbidden resource": "Bạn không có quyền thực hiện thao tác này",
  Forbidden: "Bạn không có quyền thực hiện thao tác này",
  "Not Found": "Không tìm thấy tài nguyên",
  "Too Many Requests": "Bạn thao tác quá nhanh, vui lòng thử lại sau",
  "Internal server error": "Đã xảy ra lỗi không mong muốn"
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        const message = this.translateMessage(exceptionResponse);
        response.status(statusCode).json({
          statusCode,
          message,
          errors: [message]
        });
        return;
      }

      const payload = exceptionResponse as { message?: string | string[]; errors?: string[]; statusCode?: number };
      const message = this.translateMessage(
        Array.isArray(payload.message) ? payload.message[0] : payload.message ?? DEFAULT_HTTP_ERROR_MESSAGE
      );
      const errors = payload.errors ?? (Array.isArray(payload.message) ? payload.message : [message]);

      response.status(statusCode).json({
        statusCode,
        message,
        errors: errors.map((error) => this.translateMessage(error))
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Đã xảy ra lỗi không mong muốn",
      errors: ["Đã xảy ra lỗi không mong muốn"]
    });
  }

  private translateMessage(message: string) {
    return ERROR_MESSAGE_TRANSLATIONS[message] ?? message;
  }
}
