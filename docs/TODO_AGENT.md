# To-Do List Manager Agent

A VS Code agent extension for managing todo items through natural language chat interactions.

## Features

- ✅ Create, read, update, delete todos via chat
- 📋 List and filter todos by status, priority, and tags
- 💾 Persistent storage (workspace or global)
- 🎯 Natural language command parsing
- 🔧 Integrated with VS Code Copilot Chat

## Usage

### Chat Commands

Interact with the Todo Agent through VS Code's Copilot Chat by mentioning `@todo`:

#### List Todos
```
@todo list all todos
@todo show active todos
@todo show completed todos
```

#### Create a Todo
```
@todo create a todo: Finish project documentation
@todo add task: Review PR with high priority
@todo new todo: Buy groceries
```

#### Complete a Todo
```
@todo complete todo_1234567890_abc
```

#### Delete a Todo
```
@todo delete todo_1234567890_abc
```

#### Get Help
```
@todo help
```

### Todo Properties

When creating todos, you can specify:
- **Title** (required): Main description
- **Description**: Additional details
- **Priority**: `low`, `medium`, or `high`
- **Due Date**: Timestamp
- **Tags**: Categorization labels

### Storage

Todos are automatically persisted to:
- **Workspace Storage**: When a workspace is open (project-specific)
- **Global Storage**: When no workspace is open (user-wide)

## Architecture

### Components

1. **TodoAgent** (`src/agents/todoAgent.ts`)
   - Extends `BaseAgent`
   - Handles chat interactions
   - Parses natural language commands
   - Routes to appropriate handlers

2. **TodoOperationsTool** (`src/tools/examples/todoTool.ts`)
   - Extends `BaseTool`
   - Implements CRUD operations
   - Validates parameters
   - Executes todo operations

3. **TodoPersistence** (`src/state/todoPersistence.ts`)
   - Wraps `PersistenceManager`
   - Handles todo storage/retrieval
   - Validates todo data structure
   - Manages workspace/global storage

### Data Model

```typescript
interface TodoItem {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: number;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
}
```

## Tool Operations

The `TodoOperationsTool` supports the following operations:

### create
Create a new todo item.
**Required**: `title`
**Optional**: `description`, `priority`, `dueDate`, `tags`

### read
Retrieve a specific todo by ID.
**Required**: `id`

### update
Update an existing todo.
**Required**: `id`
**Optional**: `title`, `description`, `priority`, `dueDate`, `tags`, `completed`

### delete
Delete a todo by ID.
**Required**: `id`

### list
List all todos.
**Optional**: `useWorkspace`

### complete
Mark a todo as complete.
**Required**: `id`

### filter
Filter todos by criteria.
**Optional**: `filterBy` (object with `completed`, `priority`, `tags`)

## Testing

Unit tests are located in:
- `test/unit/tools/todoTool.test.ts` - Tool CRUD operations
- `test/unit/agents/todoAgent.test.ts` - Agent behavior (to be implemented)

Run tests:
```bash
npm test
```

## Extension Points

### Custom Workflows

You can create workflows that use the TodoOperationsTool for complex operations:

```typescript
import { BaseWorkflow } from '../workflows/baseWorkflow';
import { TodoOperationsTool } from '../tools/examples/todoTool';

class TodoPlanningWorkflow extends BaseWorkflow {
    async think(): Promise<Analysis> {
        // Analyze todos and create plan
    }
    
    async act(analysis: Analysis): Promise<ActionResult[]> {
        // Execute todo organization
    }
    
    async observe(actions: ActionResult[]): Promise<Observations> {
        // Verify results
    }
}
```

### UI Integration

The agent can be integrated with webviews for visual todo management:

```typescript
// Example: Dashboard integration
const todos = await toolRegistry.executeTool('todo_operations', {
    operation: 'list'
}, context);

webviewPanel.postMessage({
    type: 'todos',
    data: todos.data
});
```

## Contributing

To extend the Todo Agent:

1. **Add new operations**: Extend `TodoOperationsTool.execute()`
2. **Add chat commands**: Update `TodoAgent.handleChatRequest()`
3. **Enhance persistence**: Modify `TodoPersistence` for new features
4. **Add workflows**: Create workflows using the Think-Act-Observe pattern

## License

Part of the VS Code Agent Extension Starter
