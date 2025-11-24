/**
 * Todo Operations Tool
 * Provides CRUD operations for managing todo items
 */

import { BaseTool } from '../baseTool';
import { ToolContext, ToolResult, ToolParameterSchema } from '../../types/index';
import { TodoPersistence } from '../../state/todoPersistence';

interface TodoOperationParams {
    operation: 'create' | 'read' | 'update' | 'delete' | 'list' | 'complete' | 'filter';
    id?: string;
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: number;
    tags?: string[];
    completed?: boolean;
    filterBy?: {
        completed?: boolean;
        priority?: 'low' | 'medium' | 'high';
        tags?: string[];
    };
    useWorkspace?: boolean;
}

/**
 * TodoOperationsTool handles all CRUD operations for todo items
 */
export class TodoOperationsTool extends BaseTool {
    readonly id = 'todo_operations';
    readonly name = 'Todo Operations';
    readonly description = 'Create, read, update, delete, list, and filter todo items';
    readonly exposeToChat = true;
    readonly requiresApproval = false;

    readonly parametersSchema: ToolParameterSchema = {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['create', 'read', 'update', 'delete', 'list', 'complete', 'filter'],
                description: 'The operation to perform'
            },
            id: {
                type: 'string',
                description: 'Todo item ID (required for read, update, delete, complete)'
            },
            title: {
                type: 'string',
                description: 'Todo title (required for create, optional for update)'
            },
            description: {
                type: 'string',
                description: 'Todo description (optional)'
            },
            priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Todo priority (optional)'
            },
            dueDate: {
                type: 'number',
                description: 'Due date as timestamp (optional)'
            },
            tags: {
                type: 'string',
                description: 'Array of tags (optional, comma-separated)'
            },
            completed: {
                type: 'boolean',
                description: 'Completion status (optional for update)'
            },
            filterBy: {
                type: 'string',
                description: 'Filter criteria for list operation (JSON string)'
            },
            useWorkspace: {
                type: 'boolean',
                description: 'Use workspace storage (true) or global storage (false). Defaults to true if workspace is available.'
            }
        },
        required: ['operation']
    } as const;

    async execute(params: TodoOperationParams, context: ToolContext): Promise<ToolResult> {
        // Validate required parameters
        const validation = this.validateParameters(params);
        if (!validation.valid) {
            return this.failure(validation.errors?.join(', ') || 'Invalid parameters');
        }

        const persistence = new TodoPersistence(context.extensionContext);
        const useWorkspace = params.useWorkspace ?? persistence.hasWorkspace();

        try {
            switch (params.operation) {
                case 'create':
                    return await this.createTodo(params, persistence, useWorkspace);
                case 'read':
                    return await this.readTodo(params, persistence, useWorkspace);
                case 'update':
                    return await this.updateTodo(params, persistence, useWorkspace);
                case 'delete':
                    return await this.deleteTodo(params, persistence, useWorkspace);
                case 'list':
                    return await this.listTodos(params, persistence, useWorkspace);
                case 'complete':
                    return await this.completeTodo(params, persistence, useWorkspace);
                case 'filter':
                    return await this.filterTodos(params, persistence, useWorkspace);
                default:
                    return this.failure(`Unknown operation: ${params.operation}`);
            }
        } catch (error) {
            return this.failure(
                `Failed to execute ${params.operation}: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async createTodo(
        params: TodoOperationParams,
        persistence: TodoPersistence,
        useWorkspace: boolean
    ): Promise<ToolResult> {
        if (!params.title) {
            return this.failure('Title is required for create operation');
        }

        const todos = await persistence.loadTodos(useWorkspace);
        const newTodo = TodoPersistence.createTodoItem(params.title, {
            description: params.description,
            priority: params.priority,
            dueDate: params.dueDate,
            tags: params.tags
        });

        todos.push(newTodo);
        await persistence.saveTodos(todos, useWorkspace);

        return this.success({
            message: 'Todo created successfully',
            todo: newTodo
        });
    }

    private async readTodo(
        params: TodoOperationParams,
        persistence: TodoPersistence,
        useWorkspace: boolean
    ): Promise<ToolResult> {
        if (!params.id) {
            return this.failure('ID is required for read operation');
        }

        const todos = await persistence.loadTodos(useWorkspace);
        const todo = todos.find(t => t.id === params.id);

        if (!todo) {
            return this.failure(`Todo not found: ${params.id}`);
        }

        return this.success({ todo });
    }

    private async updateTodo(
        params: TodoOperationParams,
        persistence: TodoPersistence,
        useWorkspace: boolean
    ): Promise<ToolResult> {
        if (!params.id) {
            return this.failure('ID is required for update operation');
        }

        const todos = await persistence.loadTodos(useWorkspace);
        const todoIndex = todos.findIndex(t => t.id === params.id);

        if (todoIndex === -1) {
            return this.failure(`Todo not found: ${params.id}`);
        }

        // Update fields
        const updatedTodo = {
            ...todos[todoIndex],
            ...(params.title !== undefined && { title: params.title }),
            ...(params.description !== undefined && { description: params.description }),
            ...(params.priority !== undefined && { priority: params.priority }),
            ...(params.dueDate !== undefined && { dueDate: params.dueDate }),
            ...(params.tags !== undefined && { tags: params.tags }),
            ...(params.completed !== undefined && { completed: params.completed }),
            updatedAt: Date.now()
        };

        todos[todoIndex] = updatedTodo;
        await persistence.saveTodos(todos, useWorkspace);

        return this.success({
            message: 'Todo updated successfully',
            todo: updatedTodo
        });
    }

    private async deleteTodo(
        params: TodoOperationParams,
        persistence: TodoPersistence,
        useWorkspace: boolean
    ): Promise<ToolResult> {
        if (!params.id) {
            return this.failure('ID is required for delete operation');
        }

        const todos = await persistence.loadTodos(useWorkspace);
        const initialLength = todos.length;
        const filteredTodos = todos.filter(t => t.id !== params.id);

        if (filteredTodos.length === initialLength) {
            return this.failure(`Todo not found: ${params.id}`);
        }

        await persistence.saveTodos(filteredTodos, useWorkspace);

        return this.success({
            message: 'Todo deleted successfully',
            id: params.id
        });
    }

    private async listTodos(
        _params: TodoOperationParams,
        persistence: TodoPersistence,
        useWorkspace: boolean
    ): Promise<ToolResult> {
        const todos = await persistence.loadTodos(useWorkspace);

        return this.success({
            count: todos.length,
            todos,
            storage: useWorkspace ? 'workspace' : 'global'
        });
    }

    private async completeTodo(
        params: TodoOperationParams,
        persistence: TodoPersistence,
        useWorkspace: boolean
    ): Promise<ToolResult> {
        if (!params.id) {
            return this.failure('ID is required for complete operation');
        }

        const todos = await persistence.loadTodos(useWorkspace);
        const todoIndex = todos.findIndex(t => t.id === params.id);

        if (todoIndex === -1) {
            return this.failure(`Todo not found: ${params.id}`);
        }

        todos[todoIndex] = {
            ...todos[todoIndex],
            completed: true,
            updatedAt: Date.now()
        };

        await persistence.saveTodos(todos, useWorkspace);

        return this.success({
            message: 'Todo marked as complete',
            todo: todos[todoIndex]
        });
    }

    private async filterTodos(
        params: TodoOperationParams,
        persistence: TodoPersistence,
        useWorkspace: boolean
    ): Promise<ToolResult> {
        const todos = await persistence.loadTodos(useWorkspace);
        let filtered = [...todos];

        if (params.filterBy) {
            if (params.filterBy.completed !== undefined) {
                filtered = filtered.filter(t => t.completed === params.filterBy!.completed);
            }

            if (params.filterBy.priority) {
                filtered = filtered.filter(t => t.priority === params.filterBy!.priority);
            }

            if (params.filterBy.tags && params.filterBy.tags.length > 0) {
                filtered = filtered.filter(t =>
                    t.tags?.some(tag => params.filterBy!.tags!.includes(tag))
                );
            }
        }

        return this.success({
            count: filtered.length,
            todos: filtered,
            filters: params.filterBy
        });
    }
}
