import * as vscode from 'vscode';
import { Tool, ToolContext, ToolMetadata, ToolResult } from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { AuditLogger } from '../governance/auditLogger.js';

/**
 * Registry for managing all tools in the extension.
 * Handles registration, execution, and lifecycle of tools.
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private metadata: Map<string, ToolMetadata> = new Map();
  private logger: Logger;

  constructor(
    private context: vscode.ExtensionContext,
    private auditLogger: AuditLogger,
    debugMode: boolean = false
  ) {
    this.logger = new Logger('ToolRegistry', debugMode);
  }

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      this.logger.warn(`Tool ${tool.id} is already registered. Overwriting.`);
    }

    this.tools.set(tool.id, tool);

    // Initialize metadata
    this.metadata.set(tool.id, {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      executionCount: 0,
    });

    // Register with Copilot Chat if applicable
    if (tool.exposeToChat) {
      try {
        // Note: This is a placeholder for when VSCode Chat API supports tool registration
        // vscode.chat.registerTool(tool.id, {
        //   description: tool.description,
        //   parametersSchema: tool.parametersSchema,
        //   handler: (parameters: any) => this.executeTool(tool.id, parameters, {
        //     extensionContext: this.context
        //   })
        // });
        this.logger.debug(`Tool ${tool.id} registered for chat (placeholder)`);
      } catch (error) {
        this.logger.error(`Failed to register tool ${tool.id} with chat`, error);
      }
    }

    this.logger.info(`Tool registered: ${tool.name} (${tool.id})`);
  }

  /**
   * Unregister a tool
   */
  unregister(toolId: string): boolean {
    if (!this.tools.has(toolId)) {
      this.logger.warn(`Tool ${toolId} not found for unregistration`);
      return false;
    }

    this.tools.delete(toolId);
    this.metadata.delete(toolId);

    this.logger.info(`Tool unregistered: ${toolId}`);
    return true;
  }

  /**
   * Execute a tool by ID
   */
  async executeTool(
    toolId: string,
    parameters: any,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolId);

    if (!tool) {
      const error = `Tool ${toolId} not found`;
      this.logger.error(error);
      return {
        success: false,
        error,
      };
    }

    try {
      // Log execution
      await this.auditLogger.logToolExecution(toolId, parameters);

      // Update metadata
      const metadata = this.metadata.get(toolId);
      if (metadata) {
        metadata.executionCount++;
        metadata.lastExecuted = Date.now();
      }

      // Execute the tool
      this.logger.debug(`Executing tool: ${toolId}`);
      const startTime = Date.now();

      const result = await tool.execute(parameters, context);

      const duration = Date.now() - startTime;
      this.logger.debug(`Tool ${toolId} executed in ${duration}ms`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tool execution failed: ${toolId}`, error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get a tool by ID
   */
  getTool(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool metadata
   */
  getMetadata(toolId: string): ToolMetadata | undefined {
    return this.metadata.get(toolId);
  }

  /**
   * Get all tool metadata
   */
  getAllMetadata(): ToolMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Get tools by category or filter
   */
  getToolsByFilter(predicate: (tool: Tool) => boolean): Tool[] {
    return Array.from(this.tools.values()).filter(predicate);
  }
}
