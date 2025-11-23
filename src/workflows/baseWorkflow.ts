import {
  Workflow,
  Analysis,
  ActionResult,
  Observations,
  AgentRequest,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

/**
 * Abstract base class for all workflows.
 * Implements the Think-Act-Observe pattern.
 */
export abstract class BaseWorkflow implements Workflow {
  abstract readonly id: string;
  abstract readonly name: string;

  protected logger: Logger;
  protected request: AgentRequest;
  protected iterations: number = 0;
  protected maxIterations: number = 3;

  constructor(request: AgentRequest, debugMode: boolean = false) {
    this.request = request;
    this.logger = new Logger(`Workflow:${this.name}`, debugMode);
  }

  /**
   * Think: Analyze the request and create a plan
   */
  abstract think(): Promise<Analysis>;

  /**
   * Act: Execute the planned actions
   */
  abstract act(analysis: Analysis): Promise<ActionResult[]>;

  /**
   * Observe: Monitor results and decide if iteration is needed
   */
  abstract observe(actions: ActionResult[]): Promise<Observations>;

  /**
   * Refine: Create a new workflow with refined approach
   */
  refine(observations: Observations): Workflow {
    // Default implementation: return this workflow with updated iteration count
    this.iterations++;
    this.logger.info(`Refining workflow, iteration ${this.iterations}`);

    // Check max iterations
    if (this.iterations >= this.maxIterations) {
      this.logger.warn('Max iterations reached, stopping refinement');
      observations.requiresIteration = false;
    }

    return this;
  }

  /**
   * Helper to check if all actions succeeded
   */
  protected allActionsSucceeded(actions: ActionResult[]): boolean {
    return actions.every((action) => action.success);
  }

  /**
   * Helper to get failed actions
   */
  protected getFailedActions(actions: ActionResult[]): ActionResult[] {
    return actions.filter((action) => !action.success);
  }

  /**
   * Helper to calculate total execution time
   */
  protected getTotalDuration(actions: ActionResult[]): number {
    return actions.reduce((sum, action) => sum + action.duration, 0);
  }
}
