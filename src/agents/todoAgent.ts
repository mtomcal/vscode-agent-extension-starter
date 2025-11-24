/**
 * Todo Agent
 * A chat-based agent for managing todo items through natural language
 */

import * as vscode from 'vscode';
import { BaseAgent } from './baseAgent';
import { ToolRegistry } from '../tools/toolRegistry';
import { WorkflowEngine } from '../workflows/workflowEngine';
import { TodoPersistence, TodoItem } from '../state/todoPersistence';
import { AgentRequest, AgentResponse, ExtensionConfig } from '../types/index';

/**
 * TodoAgent provides a natural language interface for todo management
 */
export class TodoAgent extends BaseAgent {
    private persistence: TodoPersistence;

    constructor(
        context: vscode.ExtensionContext,
        toolRegistry: ToolRegistry,
        workflowEngine: WorkflowEngine,
        config: ExtensionConfig = { 
            debugMode: false, 
            telemetryEnabled: false, 
            approvalTimeout: 60000,
            maxConcurrentWorkflows: 3,
            autoApproveReadOnly: false
        }
    ) {
        super(context, toolRegistry, workflowEngine, config);
        this.persistence = new TodoPersistence(context);
    }

    getName(): string {
        return 'todo';
    }

    async processRequest(_request: AgentRequest): Promise<AgentResponse> {
        return {
            success: true,
            result: { message: 'Todo agent - use chat interface' }
        };
    }

    async register(): Promise<void> {
        await this.activate();
    }

    async activate(): Promise<void> {
        // Create chat participant
        const participant = vscode.chat.createChatParticipant(
            'agent.todo',
            this.handleCopilotChat.bind(this)
        );

        participant.iconPath = vscode.Uri.joinPath(
            this.context.extensionUri,
            'media',
            'icon.svg'
        );

        participant.followupProvider = {
            provideFollowups: async () => {
                return [
                    {
                        prompt: 'List all my todos',
                        label: '📋 List all todos'
                    },
                    {
                        prompt: 'Show active todos',
                        label: '✅ Show active todos'
                    },
                    {
                        prompt: 'Show completed todos',
                        label: '✔️ Show completed todos'
                    },
                    {
                        prompt: 'Create a new todo',
                        label: '➕ Create new todo'
                    }
                ];
            }
        };

        this.context.subscriptions.push(participant);
    }

    async handleRequest(request: string): Promise<string> {
        // Generic request handler (for non-chat contexts)
        return `Todo agent received: ${request}`;
    }

    async handleCopilotChat(
        request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            // Use the model selected in the UI (from the request)
            const model = request.model;

            // Define tools for the LLM to use
            const tools: vscode.LanguageModelChatTool[] = [
                {
                    name: 'create_todo',
                    description: 'Create one or more todo items',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            todos: {
                                type: 'array',
                                description: 'Array of todos to create',
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string', description: 'Todo title' },
                                        description: { type: 'string', description: 'Optional description' },
                                        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' }
                                    },
                                    required: ['title']
                                }
                            }
                        },
                        required: ['todos']
                    }
                },
                {
                    name: 'list_todos',
                    description: 'List todos with optional filtering',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            filter: {
                                type: 'string',
                                enum: ['all', 'active', 'completed'],
                                description: 'Filter type'
                            }
                        }
                    }
                },
                {
                    name: 'complete_todo',
                    description: 'Mark a todo as complete. Accepts either a todo ID or a title to search for. When the user mentions a todo by name, pass the title parameter.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'Todo ID (if known)' },
                            title: { type: 'string', description: 'Todo title to search for. Use this when user mentions a todo by name instead of ID.' }
                        }
                    }
                },
                {
                    name: 'delete_todo',
                    description: 'Delete a todo. Accepts either a todo ID or a title to search for. When the user mentions a todo by name, pass the title parameter.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: 'Todo ID (if known)' },
                            title: { type: 'string', description: 'Todo title to search for. Use this when user mentions a todo by name instead of ID.' }
                        }
                    }
                }
            ];

            // Create system message with context
            const systemMessage = vscode.LanguageModelChatMessage.User(
                `You are a todo list assistant. Help users manage their todos using the available tools.\n\n` +
                `When users ask to create multiple todos, extract all tasks and create them.\n` +
                `When users ask to complete or delete a todo by name/title, use the complete_todo or delete_todo tool with the title parameter (not ID).\n` +
                `When users provide a todo ID, use the id parameter.\n` +
                `Be friendly and concise in your responses.\n\n` +
                `Important: Always use the tools provided. Don't just describe what you would do - actually call the tool.`
            );

            const userMessage = vscode.LanguageModelChatMessage.User(request.prompt);

            // Request with tool support
            const chatRequest = await model.sendRequest(
                [systemMessage, userMessage],
                { tools },
                token
            );

            let toolCallDetected = false;

            for await (const chunk of chatRequest.stream) {
                if (chunk instanceof vscode.LanguageModelToolCallPart) {
                    toolCallDetected = true;
                    // Handle tool call
                    await this.handleToolCall(chunk, stream);
                } else if (chunk instanceof vscode.LanguageModelTextPart) {
                    // Stream text response
                    stream.markdown(chunk.value);
                }
            }

            // If no tool was called, provide guidance
            if (!toolCallDetected) {
                stream.markdown('\n\n💡 *Tip: Try commands like "create todo: task name", "list todos", or "list active todos"*\n');
            }

        } catch (error) {
            this.logger.error('Error in handleCopilotChat', error);
            stream.markdown(`\n\n❌ **Error**: ${error instanceof Error ? error.message : String(error)}\n`);
        }
    }

    private async handleToolCall(
        toolCall: vscode.LanguageModelToolCallPart,
        stream: vscode.ChatResponseStream
    ): Promise<void> {
        const toolName = toolCall.name;
        const params = toolCall.input;

        switch (toolName) {
            case 'create_todo':
                await this.handleCreateToolCall(params, stream);
                break;
            case 'list_todos':
                await this.handleListToolCall(params, stream);
                break;
            case 'complete_todo':
                await this.handleCompleteToolCall(params, stream);
                break;
            case 'delete_todo':
                await this.handleDeleteToolCall(params, stream);
                break;
            default:
                stream.markdown(`❌ Unknown tool: ${toolName}\n`);
        }
    }

    private async handleCreateToolCall(params: any, stream: vscode.ChatResponseStream): Promise<void> {
        const todos = params.todos || [];
        
        if (todos.length === 0) {
            stream.markdown('❌ No todos specified\n');
            return;
        }

        stream.markdown(`Creating ${todos.length} todo${todos.length > 1 ? 's' : ''}...\n\n`);

        const tool = this.toolRegistry.getTool('todo_operations');
        if (!tool) {
            stream.markdown('❌ Todo operations tool not available\n');
            this.logger.error('Todo operations tool not found in registry');
            return;
        }

        let successCount = 0;
        for (const todo of todos) {
            try {
                this.logger.debug('Creating todo:', { title: todo.title, description: todo.description, priority: todo.priority });
                
                // Build params object with only defined values
                const params: any = {
                    operation: 'create',
                    title: todo.title
                };
                
                if (todo.description !== undefined) {
                    params.description = todo.description;
                }
                
                if (todo.priority !== undefined) {
                    params.priority = todo.priority;
                }
                
                const result = await this.toolRegistry.executeTool(
                    'todo_operations',
                    params,
                    { extensionContext: this.context }
                );

                this.logger.debug('Tool execution result:', result);

                if (result.success && result.data?.todo) {
                    const createdTodo = result.data.todo as TodoItem;
                    successCount++;
                    const priorityBadge = createdTodo.priority ? this.getPriorityBadge(createdTodo.priority) : '';
                    stream.markdown(`✅ ${priorityBadge} **${createdTodo.title}**`);
                    if (createdTodo.priority) {
                        stream.markdown(` (${createdTodo.priority})`);
                    }
                    stream.markdown(`\n`);
                } else {
                    this.logger.error('Failed to create todo:', result.error);
                    stream.markdown(`❌ Failed to create: ${todo.title} - ${result.error || 'Unknown error'}\n`);
                }
            } catch (error) {
                this.logger.error('Exception creating todo:', error);
                stream.markdown(`❌ Error creating ${todo.title}: ${error instanceof Error ? error.message : String(error)}\n`);
            }
        }

        stream.markdown(`\n**Summary**: Created ${successCount} of ${todos.length} todo${todos.length > 1 ? 's' : ''}\n`);
    }

    private async handleListToolCall(params: any, stream: vscode.ChatResponseStream): Promise<void> {
        const filter = params.filter || 'all';
        const useWorkspace = this.persistence.hasWorkspace();
        const todos = await this.persistence.loadTodos(useWorkspace);

        let filtered = todos;
        let filterType = filter;

        if (filter === 'active') {
            filtered = todos.filter(t => !t.completed);
        } else if (filter === 'completed') {
            filtered = todos.filter(t => t.completed);
        }

        filtered.sort((a, b) => b.createdAt - a.createdAt);

        stream.markdown(`## 📋 ${filterType.charAt(0).toUpperCase() + filterType.slice(1)} Todos\n\n`);

        if (filtered.length === 0) {
            stream.markdown(`No ${filterType} todos found.\n`);
            return;
        }

        stream.markdown(`Found **${filtered.length}** ${filterType} todo${filtered.length !== 1 ? 's' : ''}:\n\n`);

        for (const todo of filtered) {
            const checkbox = todo.completed ? '✅' : '☐';
            const priorityBadge = todo.priority ? this.getPriorityBadge(todo.priority) : '';
            stream.markdown(`${checkbox} **${todo.title}**${priorityBadge}`);
            if (todo.description) {
                stream.markdown(` - *${todo.description}*`);
            }
            stream.markdown(`\n   \`${todo.id}\`\n\n`);
        }
    }

    private async handleCompleteToolCall(params: any, stream: vscode.ChatResponseStream): Promise<void> {
        let id = params.id;
        
        // If no ID but has title, search for the todo by title
        if (!id && params.title) {
            const useWorkspace = this.persistence.hasWorkspace();
            const todos = await this.persistence.loadTodos(useWorkspace);
            const found = todos.find(t => 
                !t.completed && t.title.toLowerCase().includes(params.title.toLowerCase())
            );
            
            if (found) {
                id = found.id;
                stream.markdown(`Found todo: "${found.title}"\n`);
            } else {
                stream.markdown(`❌ No active todo found matching: "${params.title}"\n`);
                return;
            }
        }
        
        if (!id) {
            stream.markdown('❌ No todo ID or title specified\n');
            return;
        }

        const tool = this.toolRegistry.getTool('todo_operations');
        if (!tool) {
            stream.markdown('❌ Todo operations tool not available\n');
            return;
        }

        const result = await this.toolRegistry.executeTool(
            'todo_operations',
            { operation: 'complete', id },
            { extensionContext: this.context }
        );

        if (result.success) {
            stream.markdown(`✅ Todo marked as complete\n`);
        } else {
            stream.markdown(`❌ Failed to complete todo: ${result.error || 'Unknown error'}\n`);
        }
    }

    private async handleDeleteToolCall(params: any, stream: vscode.ChatResponseStream): Promise<void> {
        let id = params.id;
        
        // If no ID but has title, search for the todo by title
        if (!id && params.title) {
            const useWorkspace = this.persistence.hasWorkspace();
            const todos = await this.persistence.loadTodos(useWorkspace);
            const found = todos.find(t => 
                t.title.toLowerCase().includes(params.title.toLowerCase())
            );
            
            if (found) {
                id = found.id;
                stream.markdown(`Found todo: "${found.title}"\n`);
            } else {
                stream.markdown(`❌ No todo found matching: "${params.title}"\n`);
                return;
            }
        }
        
        if (!id) {
            stream.markdown('❌ No todo ID or title specified\n');
            return;
        }

        const tool = this.toolRegistry.getTool('todo_operations');
        if (!tool) {
            stream.markdown('❌ Todo operations tool not available\n');
            return;
        }

        const result = await this.toolRegistry.executeTool(
            'todo_operations',
            { operation: 'delete', id },
            { extensionContext: this.context }
        );

        if (result.success) {
            stream.markdown(`✅ Todo deleted\n`);
        } else {
            stream.markdown(`❌ Failed to delete todo: ${result.error || 'Unknown error'}\n`);
        }
    }

    private getPriorityBadge(priority: 'low' | 'medium' | 'high'): string {
        switch (priority) {
            case 'high':
                return ' 🔴';
            case 'medium':
                return ' 🟡';
            case 'low':
                return ' 🟢';
            default:
                return '';
        }
    }
}
