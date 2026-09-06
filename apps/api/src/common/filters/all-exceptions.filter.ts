import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof Error ? exception.message : "Unexpected error";
    console.error(JSON.stringify({type:"api_error",status,message}));
    response.status(status).json({error:{code:`HTTP_${status}`,message:status >= 500 ? "Something went wrong" : message},timestamp:new Date().toISOString()});
  }
}
