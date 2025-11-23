import { expect } from 'chai';
import { BaseWorkflow } from '../../../src/workflows/baseWorkflow';
import { Analysis, ActionResult, Observations, AgentRequest } from '../../../src/types/index';

class TestWorkflow extends BaseWorkflow {
  readonly id = 'test_workflow';
  readonly name = 'Test Workflow';

  public thinkCalled = false;
  public actCalled = false;
  public observeCalled = false;

  constructor(request: AgentRequest, debugMode: boolean = false) {
    super(request, debugMode);
    this.initializeLogger();
  }

  async think(): Promise<Analysis> {
    this.thinkCalled = true;
    return {
      plan: 'Test plan',
      steps: [
        {
          id: 'step_1',
          description: 'Test step',
          requiresApproval: false,
        },
      ],
      requiresApproval: false,
      confidence: 0.9,
    };
  }

  async act(analysis: Analysis): Promise<ActionResult[]> {
    this.actCalled = true;
    return [
      {
        stepId: 'step_1',
        success: true,
        result: { message: 'done' },
        duration: 100,
      },
    ];
  }

  async observe(actions: ActionResult[]): Promise<Observations> {
    this.observeCalled = true;
    return {
      success: this.allActionsSucceeded(actions),
      requiresIteration: false,
      feedback: 'All good',
    };
  }
}

describe('BaseWorkflow', () => {
  let workflow: TestWorkflow;
  let request: AgentRequest;

  beforeEach(() => {
    request = {
      id: 'test-request',
      prompt: 'Test prompt',
      context: {},
      metadata: {},
    };
    workflow = new TestWorkflow(request, false);
  });

  describe('Lifecycle', () => {
    it('should execute think phase', async () => {
      const analysis = await workflow.think();

      expect(workflow.thinkCalled).to.be.true;
      expect(analysis.plan).to.equal('Test plan');
      expect(analysis.steps).to.have.length(1);
    });

    it('should execute act phase', async () => {
      const analysis = await workflow.think();
      const actions = await workflow.act(analysis);

      expect(workflow.actCalled).to.be.true;
      expect(actions).to.have.length(1);
      expect(actions[0].success).to.be.true;
    });

    it('should execute observe phase', async () => {
      const analysis = await workflow.think();
      const actions = await workflow.act(analysis);
      const observations = await workflow.observe(actions);

      expect(workflow.observeCalled).to.be.true;
      expect(observations.success).to.be.true;
    });
  });

  describe('Helper Methods', () => {
    it('should check if all actions succeeded', async () => {
      const actions: ActionResult[] = [
        { stepId: '1', success: true, duration: 100 },
        { stepId: '2', success: true, duration: 100 },
      ];

      const result = (workflow as any).allActionsSucceeded(actions);
      expect(result).to.be.true;
    });

    it('should detect failed actions', async () => {
      const actions: ActionResult[] = [
        { stepId: '1', success: true, duration: 100 },
        { stepId: '2', success: false, error: 'failed', duration: 100 },
      ];

      const result = (workflow as any).allActionsSucceeded(actions);
      expect(result).to.be.false;
    });

    it('should get failed actions', async () => {
      const actions: ActionResult[] = [
        { stepId: '1', success: true, duration: 100 },
        { stepId: '2', success: false, error: 'failed', duration: 100 },
      ];

      const failed = (workflow as any).getFailedActions(actions);
      expect(failed).to.have.length(1);
      expect(failed[0].stepId).to.equal('2');
    });

    it('should calculate total duration', async () => {
      const actions: ActionResult[] = [
        { stepId: '1', success: true, duration: 100 },
        { stepId: '2', success: true, duration: 200 },
      ];

      const total = (workflow as any).getTotalDuration(actions);
      expect(total).to.equal(300);
    });
  });

  describe('Refinement', () => {
    it('should increment iteration count on refine', () => {
      const observations: Observations = {
        success: false,
        requiresIteration: true,
        feedback: 'Needs work',
      };

      expect(workflow['iterations']).to.equal(0);
      workflow.refine(observations);
      expect(workflow['iterations']).to.equal(1);
    });

    it('should stop iteration at max iterations', () => {
      const observations: Observations = {
        success: false,
        requiresIteration: true,
        feedback: 'Needs work',
      };

      workflow['maxIterations'] = 2;
      workflow['iterations'] = 2;

      workflow.refine(observations);
      expect(observations.requiresIteration).to.be.false;
    });
  });
});
