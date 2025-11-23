import * as vscode from 'vscode';
import { BaseAgent } from './baseAgent.js';
import { AgentRequest, AgentResponse } from '../types/index.js';
import { HumanInTheLoopManager } from '../governance/humanInTheLoop.js';

/**
 * Main agent that integrates with GitHub Copilot Chat
 */
export class CopilotAgent extends BaseAgent {
  private static readonly PARTICIPANT_ID = 'agent.assistant';
  private participant: vscode.ChatParticipant | undefined;

  constructor(
    context: vscode.ExtensionContext,
    toolRegistry: any,
    workflowEngine: any,
    config: any,
    private governanceManager: HumanInTheLoopManager
  ) {
    super(context, toolRegistry, workflowEngine, config);
  }

  getName(): string {
    return 'CopilotAgent';
  }

  async register(): Promise<void> {
    this.participant = vscode.chat.createChatParticipant(
      CopilotAgent.PARTICIPANT_ID,
      this.handleCopilotChat.bind(this)
    );

    // Set icon
    this.participant.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'media',
      'agent-icon.svg'
    );

    // Register followup provider
    this.participant.followupProvider = {
      provideFollowups: this.provideFollowups.bind(this),
    };

    this.logger.info('CopilotAgent registered successfully');
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      this.logger.debug(`Processing request: ${request.id}`);

      // Create default workflow
      const result = await this.executeWorkflow('default', request);

      return {
        success: result.success,
        result: result,
        metadata: {
          iterations: result.iterations,
        },
      };
    } catch (error) {
      this.logger.error('Error processing request', error);
      return {
        success: false,
        error: this.formatError(error),
      };
    }
  }

  async handleCopilotChat(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      // Handle specific commands
      if (request.command === 'tools') {
        await this.handleToolsCommand(stream);
        return;
      }

      if (request.command === 'status') {
        await this.handleStatusCommand(stream);
        return;
      }

      if (request.command === 'execute') {
        await this.handleExecuteCommand(request, context, stream, token);
        return;
      }

      // Default: process as a general request
      await this.handleDefaultRequest(request, context, stream, token);
    } catch (error) {
      this.logger.error('Error in handleCopilotChat', error);
      stream.markdown(`\n\n❌ ${this.formatError(error)}`);
    }
  }

  private async handleToolsCommand(stream: vscode.ChatResponseStream): Promise<void> {
    stream.markdown('## Available Tools\n\n');

    const tools = this.toolRegistry.getAllTools();

    if (tools.length === 0) {
      stream.markdown('No tools registered yet.\n');
      return;
    }

    for (const tool of tools) {
      stream.markdown(`- **${tool.name}** (${tool.id}): ${tool.description}\n`);
    }
  }

  private async handleStatusCommand(stream: vscode.ChatResponseStream): Promise<void> {
    stream.markdown('## Workflow Status\n\n');

    const activeWorkflows = this.workflowEngine.getActiveWorkflows();

    if (activeWorkflows.length === 0) {
      stream.markdown('No active workflows.\n');
      return;
    }

    for (const workflow of activeWorkflows) {
      stream.markdown(
        `- **${workflow.name}** (${workflow.id}): ${workflow.status} - ${workflow.iterations} iterations\n`
      );
    }
  }

  private async handleExecuteCommand(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    stream.progress('Analyzing request...');

    // Create agent request
    const agentRequest: AgentRequest = {
      id: Date.now().toString(),
      prompt: request.prompt,
      context: context,
      metadata: {
        command: request.command,
      },
    };

    // Execute workflow with Think-Act-Observe pattern
    const workflow = this.workflowEngine.createWorkflow('default', agentRequest);

    if (!workflow) {
      stream.markdown('❌ Failed to create workflow');
      return;
    }

    // Think phase
    stream.markdown('## 🤔 Think\n\n');
    stream.progress('Analyzing and planning...');
    const analysis = await workflow.think();

    stream.markdown(`**Plan**: ${analysis.plan}\n\n`);
    stream.markdown(`**Steps** (${analysis.steps.length}):\n`);
    for (const step of analysis.steps) {
      stream.markdown(`- ${step.description}\n`);
    }

    // Check if approval is required
    if (analysis.requiresApproval) {
      stream.markdown('\n⚠️ This action requires approval.\n\n');

      const approved = await this.governanceManager.requestApproval({
        type: 'workflow_execution',
        description: analysis.plan,
        impact: 'medium',
        reversible: false,
        details: { steps: analysis.steps },
      });

      if (!approved) {
        stream.markdown('❌ Action denied. Workflow cancelled.\n');
        return;
      }

      stream.markdown('✅ Action approved. Continuing...\n\n');
    }

    // Act phase
    stream.markdown('## 🚀 Act\n\n');
    stream.progress('Executing actions...');

    const actions = await workflow.act(analysis);

    for (const action of actions) {
      const icon = action.success ? '✅' : '❌';
      stream.markdown(`${icon} Step: ${action.stepId}\n`);
      if (action.error) {
        stream.markdown(`   Error: ${action.error}\n`);
      }
    }

    // Observe phase
    stream.markdown('\n## 👁️ Observe\n\n');
    stream.progress('Analyzing results...');

    const observations = await workflow.observe(actions);

    stream.markdown(`**Result**: ${observations.success ? 'Success' : 'Failed'}\n\n`);
    stream.markdown(`**Feedback**: ${observations.feedback}\n\n`);

    if (observations.improvements && observations.improvements.length > 0) {
      stream.markdown('**Suggested Improvements**:\n');
      for (const improvement of observations.improvements) {
        stream.markdown(`- ${improvement}\n`);
      }
    }

    // Handle iteration if needed
    if (observations.requiresIteration) {
      stream.markdown('\n🔄 Workflow requires iteration. Refining approach...\n');
      // In a real implementation, this would recursively call the workflow
      stream.markdown('*(Iteration support coming soon)*\n');
    }
  }

  private async handleDefaultRequest(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    stream.progress('Processing request...');

    // Create agent request
    const agentRequest: AgentRequest = {
      id: Date.now().toString(),
      prompt: request.prompt,
      context: context,
      metadata: {},
    };

    const response = await this.processRequest(agentRequest);

    if (response.success) {
      stream.markdown('✅ Request processed successfully.\n\n');
      if (response.result) {
        stream.markdown(`Result: ${JSON.stringify(response.result, null, 2)}\n`);
      }
    } else {
      stream.markdown(`❌ Error: ${response.error}\n`);
    }
  }
}
