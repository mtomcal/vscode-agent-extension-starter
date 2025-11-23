import { BaseTool } from '../baseTool.js';
import { ToolContext, ToolParameterSchema, ToolResult } from '../../types/index.js';

/**
 * Tool for making HTTP API requests
 */
export class ApiTool extends BaseTool {
  readonly id = 'api_request';
  readonly name = 'API Request';
  readonly description = 'Make HTTP requests to external APIs';
  readonly exposeToChat = true;
  readonly requiresApproval = false; // Read-only operations

  readonly parametersSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to request',
      },
      method: {
        type: 'string',
        description: 'HTTP method (GET, POST, PUT, DELETE)',
        default: 'GET',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      },
      headers: {
        type: 'object',
        description: 'HTTP headers as key-value pairs',
      },
      body: {
        type: 'string',
        description: 'Request body (for POST, PUT, PATCH)',
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        default: 30000,
      },
    },
    required: ['url'],
  };

  async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
    // Validate parameters
    const validation = this.validateParameters(parameters);
    if (!validation.valid) {
      return this.failure(`Invalid parameters: ${validation.errors?.join(', ')}`);
    }

    const {
      url,
      method = 'GET',
      headers = {},
      body,
      timeout = 30000,
    } = parameters;

    try {
      // Check cancellation
      if (context.cancellationToken?.isCancellationRequested) {
        return this.failure('Request cancelled');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Set up cancellation handler
      context.cancellationToken?.onCancellationRequested(() => {
        controller.abort();
      });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const contentType = response.headers.get('content-type');
      let data: any;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return this.success({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return this.failure('Request timed out or was cancelled');
        }
        return this.failure(`Request failed: ${error.message}`);
      }
      return this.failure('Unknown error occurred');
    }
  }
}
