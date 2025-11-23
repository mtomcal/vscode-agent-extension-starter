import { expect } from 'chai';
import { BaseTool } from '../../../src/tools/baseTool.js';
import { ToolContext, ToolParameterSchema, ToolResult } from '../../../src/types/index.js';
import { createMockToolContext } from '../../helpers/mocks.js';

class TestTool extends BaseTool {
  readonly id = 'test_tool';
  readonly name = 'Test Tool';
  readonly description = 'A test tool';
  readonly parametersSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Test input',
      },
      count: {
        type: 'number',
        description: 'Test count',
      },
    },
    required: ['input'],
  };

  async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
    const validation = this.validateParameters(parameters);
    if (!validation.valid) {
      return this.failure(`Invalid: ${validation.errors?.join(', ')}`);
    }
    return this.success({ result: 'ok' });
  }
}

describe('BaseTool', () => {
  let tool: TestTool;
  let context: ToolContext;

  beforeEach(() => {
    tool = new TestTool();
    context = createMockToolContext();
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters', () => {
      const result = (tool as any).validateParameters({});
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Missing required parameter: input');
    });

    it('should pass with valid parameters', () => {
      const result = (tool as any).validateParameters({ input: 'test' });
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.undefined;
    });

    it('should validate parameter types', () => {
      const result = (tool as any).validateParameters({
        input: 'test',
        count: 'not-a-number'
      });
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Parameter count must be a number');
    });
  });

  describe('Execution', () => {
    it('should execute successfully with valid parameters', async () => {
      const result = await tool.execute({ input: 'test' }, context);
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({ result: 'ok' });
    });

    it('should fail with invalid parameters', async () => {
      const result = await tool.execute({}, context);
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid');
    });
  });

  describe('Helper Methods', () => {
    it('should create success result', () => {
      const result = (tool as any).success({ data: 'test' });
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({ data: 'test' });
    });

    it('should create failure result', () => {
      const result = (tool as any).failure('error message');
      expect(result.success).to.be.false;
      expect(result.error).to.equal('error message');
    });
  });
});
