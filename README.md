# VSCode Agent Extension Starter

A comprehensive starter template for building VSCode extensions with GitHub Copilot Chat integration, featuring agentic workflows, custom tools, and advanced UI patterns.

## Features

- 🤖 **Copilot Chat Integration** - Full GitHub Copilot Chat participant API implementation
- 🔧 **Tool Registry** - Extensible tool system with automatic registration
- 🔄 **Think-Act-Observe Engine** - Recursive workflow execution with self-improvement
- ✋ **Human-in-the-Loop** - Approval system with governance rules
- 📊 **Webview Dashboard** - Native VSCode UI for monitoring agents and workflows
- 🌉 **Chat-to-Webview Bridge** - Bidirectional communication between chat and UI
- 💾 **State Management** - Persistent state with subscriber pattern
- 🎨 **CLI Scaffolding** - Quick agent and tool creation
- 🧪 **Test Framework** - Unit and integration testing setup
- ⚙️ **Auto-configuration** - Smart defaults with override capability

## Quick Start

### Prerequisites

- Node.js 20.x or later
- VSCode 1.94.0 or later
- GitHub Copilot subscription (for chat features)

### Installation

1. Clone this repository or use as a template:
```bash
git clone https://github.com/mtomcal/vscode-agent-extension-starter.git
cd vscode-agent-extension-starter
```

2. Run the setup script:
```bash
npm run setup
```

3. Open in VSCode:
```bash
code .
```

4. Press `F5` to launch the Extension Development Host

5. In the new VSCode window, open Copilot Chat and type `@agent`

## Project Structure

```
vscode-agent-extension-starter/
├── src/
│   ├── extension.ts           # Main entry point
│   ├── agents/                # Agent implementations
│   │   ├── baseAgent.ts       # Abstract base agent
│   │   ├── copilotAgent.ts    # Copilot chat participant
│   │   └── index.ts
│   ├── tools/                 # Tool system
│   │   ├── toolRegistry.ts    # Tool registration
│   │   ├── baseTool.ts        # Abstract tool class
│   │   └── examples/          # Example tools
│   ├── workflows/             # Workflow engine
│   │   ├── workflowEngine.ts  # Think-Act-Observe engine
│   │   ├── baseWorkflow.ts    # Abstract workflow
│   │   └── examples/          # Example workflows
│   ├── ui/                    # UI components
│   │   ├── webviews/          # Webview implementations
│   │   └── bridge/            # Chat-webview bridge
│   ├── governance/            # Human-in-the-loop
│   │   ├── humanInTheLoop.ts  # Approval manager
│   │   └── auditLogger.ts     # Audit trail
│   ├── state/                 # State management
│   │   ├── stateManager.ts    # Global state
│   │   └── persistence.ts     # Storage utilities
│   └── utils/                 # Utilities
│       ├── logger.ts          # Logging
│       ├── config.ts          # Configuration
│       └── telemetry.ts       # Telemetry
├── media/                     # Icons and assets
├── scripts/                   # CLI tools
│   ├── create-agent.js        # Agent scaffolding
│   └── setup.js               # Project setup
└── docs/                      # Documentation
```

## Creating Your First Agent

Use the CLI scaffolding tool:

```bash
npm run create-agent
```

Follow the prompts to create a new agent with your desired features.

## Creating Custom Tools

Tools are reusable components that agents can invoke. Create a new tool:

```typescript
// src/tools/myTool.ts
import { BaseTool } from './baseTool.js';
import { ToolContext, ToolParameterSchema, ToolResult } from '../types/index.js';

export class MyTool extends BaseTool {
  readonly id = 'my_tool';
  readonly name = 'My Tool';
  readonly description = 'Description of what this tool does';
  readonly requiresApproval = false;

  readonly parametersSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter',
      },
    },
    required: ['input'],
  };

  async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
    const validation = this.validateParameters(parameters);
    if (!validation.valid) {
      return this.failure(`Invalid parameters: ${validation.errors?.join(', ')}`);
    }

    // Your tool logic here
    return this.success({ result: 'Success!' });
  }
}
```

Register your tool in `src/extension.ts`:

```typescript
import { MyTool } from './tools/myTool.js';

// In registerTools function:
ctx.toolRegistry.register(new MyTool());
```

## Creating Custom Workflows

Workflows implement the Think-Act-Observe pattern:

```typescript
// src/workflows/myWorkflow.ts
import { BaseWorkflow } from './baseWorkflow.js';
import { Analysis, ActionResult, Observations } from '../types/index.js';

export class MyWorkflow extends BaseWorkflow {
  readonly id = 'my_workflow';
  readonly name = 'My Workflow';

  async think(): Promise<Analysis> {
    // Analyze the request and create a plan
    return {
      plan: 'Plan description',
      steps: [
        {
          id: 'step_1',
          description: 'First step',
          requiresApproval: false,
        },
      ],
      requiresApproval: false,
      confidence: 0.9,
    };
  }

  async act(analysis: Analysis): Promise<ActionResult[]> {
    // Execute the planned actions
    const results: ActionResult[] = [];
    // ... execute steps
    return results;
  }

  async observe(actions: ActionResult[]): Promise<Observations> {
    // Monitor results and decide if iteration is needed
    return {
      success: this.allActionsSucceeded(actions),
      requiresIteration: false,
      feedback: 'All actions completed successfully',
    };
  }
}
```

Register your workflow:

```typescript
ctx.workflowEngine.registerWorkflow('my_workflow', (request) => {
  return new MyWorkflow(request, ctx.config.get('debugMode'));
});
```

## Configuration

Configure the extension through VSCode settings:

```json
{
  "agentExtension.enableTelemetry": true,
  "agentExtension.debugMode": false,
  "agentExtension.approvalTimeout": 30000,
  "agentExtension.maxConcurrentWorkflows": 5,
  "agentExtension.autoApproveReadOnly": true
}
```

## Commands

- `Agent: Show Dashboard` - Open the agent dashboard
- `Agent: Clear State` - Clear all agent state
- `Agent: Create New Agent` - Scaffold a new agent
- `Agent: Register Tool` - Show tool registration guide

## Dashboard

Access the dashboard from the Activity Bar or run:

```
Command Palette > Agent: Show Dashboard
```

The dashboard shows:
- Active workflows with real-time status
- Pending approval requests
- Registered tools and their usage statistics
- Quick actions for state management

## Human-in-the-Loop Governance

Configure governance rules to control which operations require approval:

```typescript
governanceManager.addRule({
  id: 'custom_rule',
  pattern: /dangerous_operation/i,
  requiresApproval: true,
  autoApprove: false,
  priority: 100,
});
```

## Testing

The project includes comprehensive unit tests with 87% code coverage.

Run tests:

```bash
npm run test              # Run all tests
npm run test:unit         # Run unit tests only (179 passing tests)
npm run test:unit:coverage  # Run with coverage report
npm run test:integration  # Run integration tests
```

### Test Coverage

| Component | Coverage |
|-----------|----------|
| Governance (HITL, Audit, Approval) | 93% |
| Workflows (Base, Engine) | 96% |
| Tools (Base, Registry, API, File) | 90% |
| Agents (CopilotAgent) | 84% |
| State Management | 83% |
| **Overall** | **87.2%** |

## Building and Packaging

```bash
npm run compile       # Compile TypeScript
npm run package       # Build production bundle
npm run lint          # Run linter
npm run format        # Format code
```

## Publishing

1. Update `package.json` with your publisher name and version
2. Build the extension: `npm run package`
3. Create `.vsix` package: `vsce package`
4. Publish: `vsce publish`

## Architecture

### Think-Act-Observe Pattern

Workflows follow a three-phase pattern:

1. **Think**: Analyze the request and create an execution plan
2. **Act**: Execute the planned actions with tool invocations
3. **Observe**: Monitor results and decide if iteration is needed

This pattern enables self-improving agents that can refine their approach based on results.

### Tool System

Tools are independent, reusable components that can:
- Be registered with the extension
- Expose themselves to Copilot Chat
- Require approval before execution
- Validate parameters automatically
- Be invoked by workflows

### State Management

The extension uses a centralized state manager with:
- Persistent storage across sessions
- Subscriber pattern for reactive updates
- Separate workspace and global storage
- Export/import capabilities

## Examples

See the example implementations in the source code:

- **Tool examples**: [`src/tools/examples/`](src/tools/examples/) - API tool and file tool implementations
- **Workflow examples**: [`src/workflows/examples/`](src/workflows/examples/) - Sample workflow with Think-Act-Observe pattern

For architecture and integration details, see:
- [Architecture Guide](docs/ARCHITECTURE.md) - System design and patterns
- [Quick Start Guide](docs/QUICKSTART.md) - Getting started tutorial

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Issues: [GitHub Issues](https://github.com/mtomcal/vscode-agent-extension-starter/issues)
- Discussions: [GitHub Discussions](https://github.com/mtomcal/vscode-agent-extension-starter/discussions)

## Acknowledgments

Built with inspiration from:
- VSCode Extension API
- GitHub Copilot Chat API
- Agentic AI patterns
- Human-in-the-loop systems
