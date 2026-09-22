export class ApiResponseDto<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
  timestamp: string;

  static success<T>(data: T, message?: string): ApiResponseDto<T> {
    return {
      success: true,
      statusCode: 200,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static error(message: string, statusCode = 400): ApiResponseDto<null> {
    return {
      success: false,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    };
  }
}
