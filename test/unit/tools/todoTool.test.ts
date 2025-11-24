import { expect } from 'chai';
import { TodoOperationsTool } from '../../../src/tools/examples/todoTool';
import { ToolContext } from '../../../src/types/index';
import { createMockToolContext } from '../../helpers/mocks';

describe('TodoOperationsTool', () => {
  let tool: TodoOperationsTool;
  let context: ToolContext;

  beforeEach(() => {
    tool = new TodoOperationsTool();
    context = createMockToolContext();
  });

  describe('Tool Properties', () => {
    it('should have correct metadata', () => {
      expect(tool.id).to.equal('todo_operations');
      expect(tool.name).to.equal('Todo Operations');
      expect(tool.description).to.include('CRUD');
      expect(tool.exposeToChat).to.be.true;
      expect(tool.requiresApproval).to.be.false;
    });

    it('should have valid parameters schema', () => {
      expect(tool.parametersSchema.type).to.equal('object');
      expect(tool.parametersSchema.properties).to.have.property('operation');
      expect(tool.parametersSchema.required).to.include('operation');
    });
  });

  describe('Create Operation', () => {
    it('should create a todo with title', async () => {
      const result = await tool.execute(
        {
          operation: 'create',
          title: 'Test Todo'
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.message).to.include('created');
      expect(result.data?.todo).to.have.property('id');
      expect(result.data?.todo.title).to.equal('Test Todo');
      expect(result.data?.todo.completed).to.be.false;
    });

    it('should create a todo with all fields', async () => {
      const result = await tool.execute(
        {
          operation: 'create',
          title: 'Complete Todo',
          description: 'Test description',
          priority: 'high',
          tags: ['work', 'urgent']
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.todo.title).to.equal('Complete Todo');
      expect(result.data?.todo.description).to.equal('Test description');
      expect(result.data?.todo.priority).to.equal('high');
      expect(result.data?.todo.tags).to.deep.equal(['work', 'urgent']);
    });

    it('should fail without title', async () => {
      const result = await tool.execute(
        {
          operation: 'create'
        },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Title is required');
    });
  });

  describe('List Operation', () => {
    it('should list all todos', async () => {
      // Create some todos first
      await tool.execute({ operation: 'create', title: 'Todo 1' }, context);
      await tool.execute({ operation: 'create', title: 'Todo 2' }, context);

      const result = await tool.execute(
        {
          operation: 'list'
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.count).to.be.at.least(2);
      expect(result.data?.todos).to.be.an('array');
    });

    it('should return empty list when no todos exist', async () => {
      const result = await tool.execute(
        {
          operation: 'list'
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.todos).to.be.an('array');
    });
  });

  describe('Read Operation', () => {
    it('should read an existing todo', async () => {
      const createResult = await tool.execute(
        { operation: 'create', title: 'Test Todo' },
        context
      );
      const todoId = createResult.data?.todo.id;

      const result = await tool.execute(
        {
          operation: 'read',
          id: todoId
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.todo.id).to.equal(todoId);
      expect(result.data?.todo.title).to.equal('Test Todo');
    });

    it('should fail when todo not found', async () => {
      const result = await tool.execute(
        {
          operation: 'read',
          id: 'nonexistent_id'
        },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });

    it('should fail without id', async () => {
      const result = await tool.execute(
        {
          operation: 'read'
        },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('ID is required');
    });
  });

  describe('Update Operation', () => {
    it('should update todo fields', async () => {
      const createResult = await tool.execute(
        { operation: 'create', title: 'Original Title' },
        context
      );
      const todoId = createResult.data?.todo.id;

      const result = await tool.execute(
        {
          operation: 'update',
          id: todoId,
          title: 'Updated Title',
          description: 'New description',
          priority: 'high'
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.todo.title).to.equal('Updated Title');
      expect(result.data?.todo.description).to.equal('New description');
      expect(result.data?.todo.priority).to.equal('high');
    });

    it('should update completion status', async () => {
      const createResult = await tool.execute(
        { operation: 'create', title: 'Test Todo' },
        context
      );
      const todoId = createResult.data?.todo.id;

      const result = await tool.execute(
        {
          operation: 'update',
          id: todoId,
          completed: true
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.todo.completed).to.be.true;
    });

    it('should fail when todo not found', async () => {
      const result = await tool.execute(
        {
          operation: 'update',
          id: 'nonexistent_id',
          title: 'Updated'
        },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });
  });

  describe('Complete Operation', () => {
    it('should mark todo as complete', async () => {
      const createResult = await tool.execute(
        { operation: 'create', title: 'Test Todo' },
        context
      );
      const todoId = createResult.data?.todo.id;

      const result = await tool.execute(
        {
          operation: 'complete',
          id: todoId
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.todo.completed).to.be.true;
      expect(result.data?.message).to.include('complete');
    });

    it('should fail without id', async () => {
      const result = await tool.execute(
        {
          operation: 'complete'
        },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('ID is required');
    });
  });

  describe('Delete Operation', () => {
    it('should delete an existing todo', async () => {
      const createResult = await tool.execute(
        { operation: 'create', title: 'Test Todo' },
        context
      );
      const todoId = createResult.data?.todo.id;

      const result = await tool.execute(
        {
          operation: 'delete',
          id: todoId
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.message).to.include('deleted');

      // Verify it's deleted
      const readResult = await tool.execute(
        { operation: 'read', id: todoId },
        context
      );
      expect(readResult.success).to.be.false;
    });

    it('should fail when todo not found', async () => {
      const result = await tool.execute(
        {
          operation: 'delete',
          id: 'nonexistent_id'
        },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });
  });

  describe('Filter Operation', () => {
    beforeEach(async () => {
      // Create test todos with different states
      await tool.execute({
        operation: 'create',
        title: 'High Priority Task',
        priority: 'high',
        tags: ['work']
      }, context);

      await tool.execute({
        operation: 'create',
        title: 'Low Priority Task',
        priority: 'low',
        tags: ['personal']
      }, context);

      const createResult = await tool.execute({
        operation: 'create',
        title: 'Completed Task',
        priority: 'medium'
      }, context);

      // Mark one as complete
      await tool.execute({
        operation: 'complete',
        id: createResult.data?.todo.id
      }, context);
    });

    it('should filter by completion status', async () => {
      const result = await tool.execute(
        {
          operation: 'filter',
          filterBy: { completed: true }
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.count).to.be.at.least(1);
      expect(result.data?.todos.every((t: any) => t.completed === true)).to.be.true;
    });

    it('should filter by priority', async () => {
      const result = await tool.execute(
        {
          operation: 'filter',
          filterBy: { priority: 'high' }
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.todos.every((t: any) => t.priority === 'high')).to.be.true;
    });

    it('should filter by tags', async () => {
      const result = await tool.execute(
        {
          operation: 'filter',
          filterBy: { tags: ['work'] }
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data?.todos.every((t: any) => 
        t.tags?.includes('work')
      )).to.be.true;
    });

    it('should combine multiple filters', async () => {
      const result = await tool.execute(
        {
          operation: 'filter',
          filterBy: {
            completed: false,
            priority: 'high'
          }
        },
        context
      );

      expect(result.success).to.be.true;
      if (result.data?.todos.length > 0) {
        expect(result.data?.todos.every((t: any) => 
          t.completed === false && t.priority === 'high'
        )).to.be.true;
      }
    });
  });

  describe('Invalid Operations', () => {
    it('should fail with unknown operation', async () => {
      const result = await tool.execute(
        {
          operation: 'unknown' as any
        },
        context
      );

      expect(result.success).to.be.false;
    });
  });
});
