import * as vscode from 'vscode';
import {
  AgentRequest,
  AgentResponse,
  ExtensionConfig,
  WorkflowResult,
} from '../types/index.js';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { WorkflowEngine } from '../workflows/workflowEngine.js';
import { Logger } from '../utils/logger.js';

/**
 * Abstract base class for all agents in the extension.
 * Provides common functionality for request handling, tool access, and workflow execution.
 */
export abstract class BaseAgent {
  protected logger: Logger;

  constructor(
    protected context: vscode.ExtensionContext,
    protected toolRegistry: ToolRegistry,
    protected workflowEngine: WorkflowEngine,
    protected config: ExtensionConfig
  ) {
    this.logger = new Logger(this.getName(), config.debugMode);
  }

  /**
   * Returns the unique name of this agent
   */
  abstract getName(): string;

  /**
   * Process a generic agent request
   */
  abstract processRequest(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Handle a Copilot Chat request
   */
  abstract handleCopilotChat(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void>;

  /**
   * Register the agent with VSCode
   */
  abstract register(): Promise<void>;

  /**
   * Provide follow-up suggestions for chat
   */
  protected async provideFollowups(
    result: vscode.ChatResult,
    context: vscode.ChatContext,
    token: vscode.CancellationToken
  ): Promise<vscode.ChatFollowup[]> {
    return [
      {
        prompt: 'Show me the available tools',
        label: 'List Tools',
        command: 'tools',
      },
      {
        prompt: 'What is the status of current workflows?',
        label: 'Workflow Status',
        command: 'status',
      },
    ];
  }

  /**
   * Execute a workflow and return the result
   */
  protected async executeWorkflow(
    workflowName: string,
    request: AgentRequest,
    stream?: vscode.ChatResponseStream,
    token?: vscode.CancellationToken
  ): Promise<WorkflowResult> {
    this.logger.debug(`Executing workflow: ${workflowName}`);

    const workflow = this.workflowEngine.createWorkflow(workflowName, request);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }

    return await this.workflowEngine.executeWorkflow(workflow, stream, token);
  }

  /**
   * Format error messages for display
   */
  protected formatError(error: unknown): string {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return String(error);
  }

  /**
   * Check if the agent should handle this request
   */
  protected shouldHandle(request: vscode.ChatRequest): boolean {
    // Override in subclasses for custom logic
    return true;
  }
}
