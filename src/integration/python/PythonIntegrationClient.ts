import {
  PYTHON_INTEGRATION_CONTRACT_VERSION,
  PythonIntegrationStatus,
  type PythonIntegrationClient,
  type PythonIntegrationOperation,
  type PythonIntegrationPayload,
  type PythonIntegrationRequest,
  type PythonIntegrationRequestContext,
  type PythonIntegrationSuccessResponse,
  type PythonIntegrationTransport,
  validatePythonIntegrationRequest,
  validatePythonIntegrationResponse,
} from "../../contracts";
import { AlphaIntegrationError } from "./AlphaIntegrationError";

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Integration validation failed.";
}

export class DefaultPythonIntegrationClient implements PythonIntegrationClient {
  constructor(private readonly transport: PythonIntegrationTransport) {}

  execute<Operation extends PythonIntegrationOperation>(
    operation: Operation,
    payload: Readonly<PythonIntegrationPayload<Operation>>,
    context: Readonly<PythonIntegrationRequestContext>,
  ): PythonIntegrationSuccessResponse<Operation> {
    const candidate = {
      contractVersion: PYTHON_INTEGRATION_CONTRACT_VERSION,
      requestId: context.requestId,
      operation,
      requestedAt: context.requestedAt,
      payload,
      ...(context.metadata === undefined ? {} : { metadata: context.metadata }),
    };

    let request: PythonIntegrationRequest;
    try {
      request = validatePythonIntegrationRequest(candidate);
    } catch (error: unknown) {
      throw AlphaIntegrationError.validation(safeMessage(error));
    }

    let rawResponse: unknown;
    try {
      rawResponse = this.transport.send(request);
    } catch (error: unknown) {
      if (error instanceof AlphaIntegrationError) {
        throw error;
      }
      throw AlphaIntegrationError.transport("The Python integration transport failed.");
    }

    let response;
    try {
      response = validatePythonIntegrationResponse(rawResponse, request);
    } catch (error: unknown) {
      throw AlphaIntegrationError.protocol(safeMessage(error));
    }

    if (response.status === PythonIntegrationStatus.Failure) {
      throw new AlphaIntegrationError(response.error);
    }
    return response as PythonIntegrationSuccessResponse<Operation>;
  }
}
