# Architecture Documentation

## Overview

The VSCode Agent Extension Starter is built on a modular architecture that separates concerns and enables extensibility. This document describes the core architectural patterns and components.

## Core Concepts

### 1. Agents

Agents are the primary actors that handle user requests. They integrate with GitHub Copilot Chat and coordinate between tools, workflows, and governance systems.

**Key responsibilities:**
- Process user requests from Copilot Chat
- Coordinate workflow execution
- Manage tool invocations
- Handle approval requests
- Stream responses to users

**Base class:**
```typescript
abstract class BaseAgent {
  abstract getName(): string;
  abstract processRequest(request: AgentRequest): Promise<AgentResponse>;
  abstract handleCopilotChat(...): Promise<void>;
  abstract register(): Promise<void>;
}
```

### 2. Tools

Tools are reusable, self-contained components that perform specific operations. They can be invoked by agents or workflows and can be exposed to Copilot Chat.

**Key features:**
- Parameter validation
- Approval requirements
- Context awareness
- Error handling

**Base class:**
```typescript
abstract class BaseTool implements Tool {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parametersSchema: ToolParameterSchema;
  abstract execute(parameters: any, context: ToolContext): Promise<ToolResult>;
}
```

### 3. Workflows

Workflows implement the Think-Act-Observe pattern for complex, multi-step operations. They can iterate and self-improve based on results.

**Phases:**

1. **Think**: Analyze the request and create an execution plan
   - Parse user intent
   - Identify required tools
   - Estimate complexity and confidence
   - Determine approval requirements

2. **Act**: Execute the planned actions
   - Invoke tools in sequence or parallel
   - Handle errors and retries
   - Track execution metrics
   - Report progress

3. **Observe**: Monitor results and adapt
   - Evaluate success criteria
   - Identify improvement opportunities
   - Decide if iteration is needed
   - Generate feedback

**Base class:**
```typescript
abstract class BaseWorkflow implements Workflow {
  abstract think(): Promise<Analysis>;
  abstract act(analysis: Analysis): Promise<ActionResult[]>;
  abstract observe(actions: ActionResult[]): Promise<Observations>;
  refine(observations: Observations): Workflow;
}
```

### 4. Workflow Engine

The workflow engine orchestrates workflow execution with support for:
- Multiple concurrent workflows
- Iteration with max limits
- Progress tracking
- Cancellation
- Integration with governance

### 5. Governance System

The governance system provides human-in-the-loop control through:

**Components:**
- **HumanInTheLoopManager**: Approval request handling
- **AuditLogger**: Comprehensive audit trail
- **ApprovalManager**: High-level approval coordination

**Governance Rules:**
Rules define automatic approval/denial policies:
```typescript
interface GovernanceRule {
  id: string;
  pattern: RegExp;
  requiresApproval: boolean;
  autoApprove: boolean;
  priority: number;
}
```

### 6. State Management

State management uses a centralized manager with:

**Features:**
- Persistent storage (global state)
- Subscriber pattern for reactive updates
- Debounced persistence
- Export/import capabilities
- Type-safe updates

**Storage tiers:**
- **Global State**: Extension-wide state (via Memento API)
- **Workspace Storage**: Project-specific files
- **Global Storage**: User-wide files

### 7. UI System

The UI system consists of:

**Webview Dashboard:**
- Workflow monitoring
- Approval queue
- Tool catalog
- Quick actions

**Chat-to-Webview Bridge:**
- Bidirectional messaging
- Message queuing
- Handler registration
- Broadcasting

## Data Flow

### Chat Request Flow

```
User Input (@agent in Copilot Chat)
  ↓
CopilotAgent.handleCopilotChat()
  ↓
WorkflowEngine.executeWorkflow()
  ↓
Think → Act → Observe
  ↓
(Iterate if needed)
  ↓
Response Stream → User
```

### Tool Execution Flow

```
Workflow.act()
  ↓
ToolRegistry.executeTool()
  ↓
AuditLogger.logToolExecution()
  ↓
Tool.execute()
  ↓
Result → Workflow
```

### Approval Flow

```
Workflow identifies sensitive operation
  ↓
HumanInTheLoopManager.requestApproval()
  ↓
Check governance rules
  ↓
Show approval dialog OR Auto-approve/deny
  ↓
AuditLogger.logApproval()
  ↓
Continue or abort workflow
```

## Key Patterns

### 1. Dependency Injection

All major components receive dependencies through constructors:

```typescript
class CopilotAgent extends BaseAgent {
  constructor(
    context: ExtensionContext,
    toolRegistry: ToolRegistry,
    workflowEngine: WorkflowEngine,
    config: ExtensionConfig,
    governanceManager: HumanInTheLoopManager
  ) {
    super(context, toolRegistry, workflowEngine, config);
  }
}
```

Benefits:
- Testability
- Flexibility
- Clear dependencies

### 2. Observer Pattern

State management uses observers for reactive updates:

```typescript
stateManager.subscribeToChanges((state) => {
  // React to state changes
});
```

### 3. Strategy Pattern

Workflows are strategies for handling requests:

```typescript
workflowEngine.registerWorkflow('strategy_name', (request) => {
  return new ConcreteWorkflow(request);
});
```

### 4. Command Pattern

Tools encapsulate operations as objects:

```typescript
interface Tool {
  execute(parameters: any, context: ToolContext): Promise<ToolResult>;
}
```

### 5. Factory Pattern

Workflow engine uses factories to create workflow instances:

```typescript
const workflow = workflowEngine.createWorkflow('name', request);
```

## Extension Points

### Creating Custom Agents

1. Extend `BaseAgent`
2. Implement required methods
3. Register in `extension.ts`

### Adding Custom Tools

1. Extend `BaseTool`
2. Define parameters schema
3. Implement `execute()` method
4. Register with `ToolRegistry`

### Creating Custom Workflows

1. Extend `BaseWorkflow`
2. Implement Think-Act-Observe methods
3. Register with `WorkflowEngine`

### Adding UI Components

1. Create webview provider
2. Implement `resolveWebviewView()`
3. Register with VSCode
4. Connect to `ChatWebviewBridge`

## Security Considerations

### 1. Approval Requirements

Sensitive operations should require approval:
- File system writes
- External API calls with credentials
- Code execution
- Workspace modifications

### 2. Audit Trail

All operations are logged for accountability:
- Tool executions
- Approval decisions
- Workflow executions
- Errors

### 3. Input Validation

Tools validate parameters before execution:
- Type checking
- Required fields
- Enum validation
- Custom validators

### 4. Governance Rules

Rules provide defense in depth:
- Pattern-based matching
- Priority ordering
- Auto-approval for safe operations
- Auto-denial for dangerous operations

## Performance Considerations

### 1. Debounced Persistence

State changes are debounced to reduce I/O:
```typescript
private saveDebounceMs = 1000;
```

### 2. Message Queuing

Bridge queues messages when webview is disconnected:
```typescript
private maxQueueSize = 100;
```

### 3. Concurrent Workflows

Engine limits concurrent workflows:
```typescript
maxConcurrentWorkflows: 5
```

### 4. Lazy Loading

Components are loaded on demand when possible.

## Testing Strategy

### Unit Tests

Test individual components in isolation:
- Tools
- Workflows
- State management
- Utilities

### Integration Tests

Test component interactions:
- Agent + Workflow + Tools
- State + Persistence
- Governance + Audit

### End-to-End Tests

Test complete user flows:
- Chat interaction
- Approval flow
- Dashboard interaction

## Error Handling

### Levels

1. **Tool Level**: Return `ToolResult` with error
2. **Workflow Level**: Catch and log, continue or fail
3. **Agent Level**: Format and stream to user
4. **Extension Level**: Log and show notification

### Recovery

- Workflows can retry failed steps
- Governance can provide alternative paths
- State is preserved across failures

## Configuration Management

Configuration flows:
```
VSCode Settings
  ↓
ConfigurationManager
  ↓
Components (via dependency injection)
```

Changes are:
- Watched automatically
- Applied immediately
- Logged for debugging

## Monitoring and Observability

### Logging

Structured logging with levels:
- **DEBUG**: Detailed diagnostic information
- **INFO**: General informational messages
- **WARN**: Warning messages
- **ERROR**: Error messages with stack traces

### Telemetry

Anonymous usage tracking (opt-in):
- Extension activation
- Agent usage
- Tool execution
- Workflow performance
- Error rates

### Audit Trail

Complete audit log of:
- All tool executions
- All approval decisions
- All workflow executions
- All errors

## Future Extensibility

The architecture supports future additions:

1. **Multiple Agent Types**: Framework supports any agent type
2. **Custom Storage**: Persistence layer is abstracted
3. **External Services**: Bridge pattern enables integration
4. **Plugin System**: Tool and workflow registration is dynamic
5. **Custom UI**: Webview system is extensible

## Best Practices

1. **Follow patterns**: Use existing patterns for new components
2. **Dependency injection**: Pass dependencies, don't create them
3. **Async/await**: Use async patterns consistently
4. **Error handling**: Always handle errors gracefully
5. **Logging**: Log important events and errors
6. **Testing**: Write tests for new components
7. **Documentation**: Document public APIs
8. **Type safety**: Use TypeScript features fully

## Conclusion

This architecture provides:
- **Modularity**: Components are independent
- **Extensibility**: Easy to add new features
- **Testability**: Components can be tested in isolation
- **Maintainability**: Clear separation of concerns
- **Safety**: Human-in-the-loop governance
- **Observability**: Comprehensive logging and audit trail
