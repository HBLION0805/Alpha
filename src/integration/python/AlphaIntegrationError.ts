import {
  PythonIntegrationErrorCategory,
  PythonIntegrationErrorCode,
  type PythonIntegrationFailure,
} from "../../contracts";

export class AlphaIntegrationError extends Error {
  readonly code: PythonIntegrationErrorCode;
  readonly category: PythonIntegrationErrorCategory;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string>>;

  constructor(failure: Readonly<PythonIntegrationFailure>) {
    super(failure.message);
    this.name = "AlphaIntegrationError";
    this.code = failure.code;
    this.category = failure.category;
    this.retryable = failure.retryable;
    if (failure.details !== undefined) {
      this.details = failure.details;
    }
  }

  static validation(message: string): AlphaIntegrationError {
    return new AlphaIntegrationError({
      code: PythonIntegrationErrorCode.ValidationError,
      category: PythonIntegrationErrorCategory.Validation,
      message,
      retryable: false,
    });
  }

  static protocol(message: string): AlphaIntegrationError {
    return new AlphaIntegrationError({
      code: PythonIntegrationErrorCode.ProtocolError,
      category: PythonIntegrationErrorCategory.Protocol,
      message,
      retryable: false,
    });
  }

  static transport(message: string): AlphaIntegrationError {
    return new AlphaIntegrationError({
      code: PythonIntegrationErrorCode.TransportError,
      category: PythonIntegrationErrorCategory.Transport,
      message,
      retryable: true,
    });
  }

  static timeout(message: string): AlphaIntegrationError {
    return new AlphaIntegrationError({
      code: PythonIntegrationErrorCode.Timeout,
      category: PythonIntegrationErrorCategory.Transport,
      message,
      retryable: true,
    });
  }
}
