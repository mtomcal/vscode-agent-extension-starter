import {
  Analysis,
  ActionResult,
  Observations,
  AgentRequest,
  WorkflowStep,
} from '../../types/index.js';
import { BaseWorkflow } from '../baseWorkflow.js';

/**
 * Sample workflow demonstrating Think-Act-Observe pattern
 */
export class SampleWorkflow extends BaseWorkflow {
  readonly id = 'sample_workflow';
  readonly name = 'Sample Workflow';

  constructor(request: AgentRequest, debugMode: boolean = false) {
    super(request, debugMode);
    this.initializeLogger();
  }

  async think(): Promise<Analysis> {
    this.logger.info('Think: Analyzing request');

    // Analyze the request and create a plan
    const prompt = this.request.prompt.toLowerCase();

    const steps: WorkflowStep[] = [];

    // Example: Create steps based on keywords
    if (prompt.includes('read') || prompt.includes('list')) {
      steps.push({
        id: 'step_1',
        description: 'List files in workspace',
        toolId: 'file_operations',
        parameters: {
          operation: 'list',
          path: '.',
        },
        requiresApproval: false,
      });
    }

    if (prompt.includes('write') || prompt.includes('create')) {
      steps.push({
        id: 'step_2',
        description: 'Create a new file',
        toolId: 'file_operations',
        parameters: {
          operation: 'write',
          path: 'output.txt',
          content: 'Generated content',
        },
        requiresApproval: true,
      });
    }

    if (prompt.includes('api') || prompt.includes('fetch')) {
      steps.push({
        id: 'step_3',
        description: 'Fetch data from API',
        toolId: 'api_request',
        parameters: {
          url: 'https://api.example.com/data',
          method: 'GET',
        },
        requiresApproval: false,
      });
    }

    // Default step if no specific keywords found
    if (steps.length === 0) {
      steps.push({
        id: 'step_default',
        description: 'Process general request',
        requiresApproval: false,
      });
    }

    const analysis: Analysis = {
      plan: `Execute ${steps.length} step(s) to complete the request`,
      steps,
      requiresApproval: steps.some((step) => step.requiresApproval),
      confidence: 0.8,
    };

    this.logger.debug(`Analysis complete: ${steps.length} steps planned`);
    return analysis;
  }

  async act(analysis: Analysis): Promise<ActionResult[]> {
    this.logger.info('Act: Executing planned steps');

    const results: ActionResult[] = [];

    for (const step of analysis.steps) {
      const startTime = Date.now();

      try {
        // Simulate action execution
        // In a real implementation, this would call the tool registry
        await this.simulateAction(step);

        results.push({
          stepId: step.id,
          success: true,
          result: {
            message: `Step ${step.id} completed successfully`,
          },
          duration: Date.now() - startTime,
        });

        this.logger.debug(`Step ${step.id} completed successfully`);
      } catch (error) {
        results.push({
          stepId: step.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        });

        this.logger.error(`Step ${step.id} failed`, error);
      }
    }

    return results;
  }

  async observe(actions: ActionResult[]): Promise<Observations> {
    this.logger.info('Observe: Analyzing results');

    const allSucceeded = this.allActionsSucceeded(actions);
    const failedActions = this.getFailedActions(actions);
    const totalDuration = this.getTotalDuration(actions);

    let feedback: string;
    let requiresIteration = false;
    const improvements: string[] = [];

    if (allSucceeded) {
      feedback = `All ${actions.length} actions completed successfully in ${totalDuration}ms`;
    } else {
      feedback = `${failedActions.length} of ${actions.length} actions failed`;
      requiresIteration = this.iterations < this.maxIterations;

      if (requiresIteration) {
        improvements.push('Retry failed actions with different parameters');
        improvements.push('Add error handling for edge cases');
      }
    }

    const observations: Observations = {
      success: allSucceeded,
      requiresIteration,
      feedback,
      improvements: improvements.length > 0 ? improvements : undefined,
    };

    this.logger.debug(`Observation complete: ${feedback}`);
    return observations;
  }

  private async simulateAction(_step: WorkflowStep): Promise<void> {
    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Simulate random failures for demonstration
    if (Math.random() < 0.1) {
      throw new Error('Simulated random failure');
    }
  }
}
