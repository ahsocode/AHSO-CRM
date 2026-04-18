import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        response.status(statusCode).json({
          statusCode,
          message: exceptionResponse,
          errors: [exceptionResponse]
        });
        return;
      }

      const payload = exceptionResponse as { message?: string | string[]; errors?: string[]; statusCode?: number };
      const message = Array.isArray(payload.message) ? payload.message[0] : payload.message ?? "Request failed";

      response.status(statusCode).json({
        statusCode,
        message,
        errors: payload.errors ?? (Array.isArray(payload.message) ? payload.message : [message])
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Đã xảy ra lỗi không mong muốn",
      errors: ["Đã xảy ra lỗi không mong muốn"]
    });
  }
}

