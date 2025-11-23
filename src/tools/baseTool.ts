import { Tool, ToolContext, ToolParameterSchema, ToolResult } from '../types/index.js';

/**
 * Abstract base class for all tools.
 * Tools are reusable components that can be invoked by agents.
 */
export abstract class BaseTool implements Tool {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parametersSchema: ToolParameterSchema;

  /**
   * Whether this tool should be exposed to Copilot Chat
   */
  readonly exposeToChat: boolean = true;

  /**
   * Whether this tool requires human approval before execution
   */
  readonly requiresApproval: boolean = false;

  /**
   * Execute the tool with the given parameters
   */
  abstract execute(parameters: any, context: ToolContext): Promise<ToolResult>;

  /**
   * Validate parameters before execution
   */
  protected validateParameters(parameters: any): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check required parameters
    if (this.parametersSchema.required) {
      for (const required of this.parametersSchema.required) {
        if (!(required in parameters)) {
          errors.push(`Missing required parameter: ${required}`);
        }
      }
    }

    // Basic type checking
    for (const [key, schema] of Object.entries(this.parametersSchema.properties)) {
      if (key in parameters) {
        const value = parameters[key];
        const expectedType = schema.type;

        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`Parameter ${key} must be a string`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`Parameter ${key} must be a number`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Parameter ${key} must be a boolean`);
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Parameter ${key} must be an array`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Create a success result
   */
  protected success(data?: any): ToolResult {
    return {
      success: true,
      data,
    };
  }

  /**
   * Create a failure result
   */
  protected failure(error: string): ToolResult {
    return {
      success: false,
      error,
    };
  }
}
