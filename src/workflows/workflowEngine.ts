import * as vscode from 'vscode';
import {
  Workflow,
  WorkflowResult,
  WorkflowState,
  AgentRequest,
  ExtensionConfig,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { HumanInTheLoopManager } from '../governance/humanInTheLoop.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Engine for executing workflows using the Think-Act-Observe pattern.
 * Manages workflow lifecycle, iteration, and coordination with governance.
 */
export class WorkflowEngine {
  private activeWorkflows: Map<string, WorkflowState> = new Map();
  private workflowFactories: Map<string, (request: AgentRequest) => Workflow> = new Map();
  private logger: Logger;

  constructor(
    private governanceManager: HumanInTheLoopManager,
    private config: ExtensionConfig
  ) {
    this.logger = new Logger('WorkflowEngine', config.debugMode);
  }

  /**
   * Register a workflow factory
   */
  registerWorkflow(name: string, factory: (request: AgentRequest) => Workflow): void {
    this.workflowFactories.set(name, factory);
    this.logger.info(`Workflow registered: ${name}`);
  }

  /**
   * Create a workflow instance
   */
  createWorkflow(name: string, request: AgentRequest): Workflow | null {
    const factory = this.workflowFactories.get(name);

    if (!factory) {
      this.logger.error(`Workflow factory not found: ${name}`);
      return null;
    }

    return factory(request);
  }

  /**
   * Execute a workflow with Think-Act-Observe pattern
   */
  async executeWorkflow(
    workflow: Workflow,
    stream?: vscode.ChatResponseStream,
    token?: vscode.CancellationToken
  ): Promise<WorkflowResult> {
    const workflowId = uuidv4();

    // Initialize state
    const state: WorkflowState = {
      id: workflowId,
      name: workflow.name,
      status: 'thinking',
      startTime: Date.now(),
      iterations: 0,
    };

    this.activeWorkflows.set(workflowId, state);

    try {
      return await this.executeWorkflowInternal(workflow, state, stream, token);
    } finally {
      // Clean up
      state.endTime = Date.now();
      state.status = 'completed';

      // Keep in memory for a while for status queries
      setTimeout(() => {
        this.activeWorkflows.delete(workflowId);
      }, 60000); // 1 minute
    }
  }

  private async executeWorkflowInternal(
    workflow: Workflow,
    state: WorkflowState,
    stream?: vscode.ChatResponseStream,
    token?: vscode.CancellationToken
  ): Promise<WorkflowResult> {
    let currentWorkflow = workflow;
    const maxIterations = this.config.maxConcurrentWorkflows || 5;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Check cancellation
      if (token?.isCancellationRequested) {
        state.status = 'failed';
        state.error = 'Cancelled by user';
        throw new Error('Workflow cancelled');
      }

      // Check max iterations
      if (state.iterations >= maxIterations) {
        this.logger.warn(`Max iterations (${maxIterations}) reached for workflow ${state.name}`);
        break;
      }

      state.iterations++;

      // THINK PHASE
      state.status = 'thinking';
      state.currentPhase = { name: 'think', status: 'in_progress' };
      stream?.progress('Thinking...');

      this.logger.debug(`Think phase started for ${workflow.name}`);
      const analysis = await currentWorkflow.think();
      state.currentPhase.status = 'completed';
      state.currentPhase.result = analysis;

      // Check governance requirements
      if (analysis.requiresApproval && !this.config.autoApproveReadOnly) {
        const approved = await this.requestApproval(analysis, stream);

        if (!approved) {
          state.status = 'failed';
          state.error = 'Action denied by user';

          return {
            success: false,
            analysis,
            actions: [],
            observations: {
              success: false,
              requiresIteration: false,
              feedback: 'Action denied by user',
            },
            iterations: state.iterations,
          };
        }
      }

      // ACT PHASE
      state.status = 'acting';
      state.currentPhase = { name: 'act', status: 'in_progress' };
      stream?.progress('Acting...');

      this.logger.debug(`Act phase started for ${workflow.name}`);
      const actions = await currentWorkflow.act(analysis);
      state.currentPhase.status = 'completed';
      state.currentPhase.result = actions;

      // OBSERVE PHASE
      state.status = 'observing';
      state.currentPhase = { name: 'observe', status: 'in_progress' };
      stream?.progress('Observing...');

      this.logger.debug(`Observe phase started for ${workflow.name}`);
      const observations = await currentWorkflow.observe(actions);
      state.currentPhase.status = 'completed';
      state.currentPhase.result = observations;

      // Check if iteration is needed
      if (!observations.requiresIteration) {
        state.status = 'completed';

        return {
          success: observations.success,
          analysis,
          actions,
          observations,
          iterations: state.iterations,
        };
      }

      // Refine workflow for next iteration
      this.logger.info(`Refining workflow ${workflow.name}, iteration ${state.iterations}`);
      stream?.progress(`Refining approach (iteration ${state.iterations})...`);
      currentWorkflow = currentWorkflow.refine(observations);
    }

    // Max iterations reached
    state.status = 'completed';

    return {
      success: false,
      analysis: state.currentPhase?.result?.analysis || { plan: '', steps: [], requiresApproval: false, confidence: 0 },
      actions: state.currentPhase?.result?.actions || [],
      observations: {
        success: false,
        requiresIteration: false,
        feedback: `Max iterations (${maxIterations}) reached`,
      },
      iterations: state.iterations,
    };
  }

  private async requestApproval(
    analysis: any,
    stream?: vscode.ChatResponseStream
  ): Promise<boolean> {
    stream?.markdown('\n⚠️ This action requires approval.\n\n');

    const approved = await this.governanceManager.requestApproval({
      type: 'workflow_execution',
      description: analysis.plan,
      impact: 'medium',
      reversible: false,
      details: { steps: analysis.steps },
    });

    return approved;
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): WorkflowState[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Get workflow state by ID
   */
  getWorkflowState(workflowId: string): WorkflowState | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Cancel a workflow
   */
  cancelWorkflow(workflowId: string): boolean {
    const state = this.activeWorkflows.get(workflowId);

    if (!state) {
      return false;
    }

    state.status = 'failed';
    state.error = 'Cancelled by user';
    state.endTime = Date.now();

    return true;
  }
}
