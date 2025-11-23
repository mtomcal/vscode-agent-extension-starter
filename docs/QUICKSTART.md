# Quick Start Guide

Get up and running with VSCode Agent Extension Starter in 5 minutes.

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 20.x or later installed
- ✅ VSCode 1.94.0 or later installed
- ✅ GitHub Copilot subscription (for chat features)
- ✅ Basic TypeScript knowledge

## Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/vscode-agent-extension-starter.git
cd vscode-agent-extension-starter

# Run setup
npm run setup
```

The setup script will:
- Install all dependencies
- Create necessary directories
- Build the extension
- Configure your development environment

## Step 2: Open in VSCode

```bash
code .
```

## Step 3: Launch Extension Development Host

1. Press `F5` (or select "Run > Start Debugging")
2. A new VSCode window will open with the extension loaded
3. This is your Extension Development Host

## Step 4: Test the Extension

In the Extension Development Host:

1. Open Copilot Chat (Ctrl+Shift+I or Cmd+Shift+I)
2. Type `@agent` and press Enter
3. Try some commands:
   - `@agent /execute list files in workspace`
   - `@agent /tools` - See available tools
   - `@agent /status` - Check workflow status

## Step 5: View the Dashboard

1. Click the Agent icon in the Activity Bar (left sidebar)
2. The dashboard shows:
   - Active workflows
   - Pending approvals
   - Registered tools
   - Quick actions

## Your First Customization

Let's create a simple custom tool.

### Create a New Tool

1. Create a file: `src/tools/examples/greetingTool.ts`

```typescript
import { BaseTool } from '../baseTool.js';
import { ToolContext, ToolParameterSchema, ToolResult } from '../../types/index.js';

export class GreetingTool extends BaseTool {
  readonly id = 'greeting';
  readonly name = 'Greeting Tool';
  readonly description = 'Generate a friendly greeting';
  readonly requiresApproval = false;

  readonly parametersSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name to greet',
      },
      language: {
        type: 'string',
        description: 'Language for greeting',
        default: 'en',
        enum: ['en', 'es', 'fr'],
      },
    },
    required: ['name'],
  };

  async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
    const validation = this.validateParameters(parameters);
    if (!validation.valid) {
      return this.failure(`Invalid parameters: ${validation.errors?.join(', ')}`);
    }

    const { name, language = 'en' } = parameters;

    const greetings: Record<string, string> = {
      en: `Hello, ${name}!`,
      es: `¡Hola, ${name}!`,
      fr: `Bonjour, ${name}!`,
    };

    return this.success({
      greeting: greetings[language],
      name,
      language,
    });
  }
}
```

2. Register the tool in `src/extension.ts`:

```typescript
// Add import at the top
import { GreetingTool } from './tools/examples/greetingTool.js';

// In the registerTools() function, add:
ctx.toolRegistry.register(new GreetingTool());
```

3. Reload the Extension Development Host (Ctrl+R or Cmd+R)

4. Test your tool:
```
@agent /execute greet Alice in Spanish
```

## Your First Agent

Let's create a custom agent using the CLI tool.

### Create an Agent

1. In the terminal, run:
```bash
npm run create-agent
```

2. Answer the prompts:
```
Agent name: myAgent
Display name: My Custom Agent
Description: My first custom agent
Agent type: 1 (chat)
Features: 1,2 (HITL and tools)
```

3. The CLI will generate `src/agents/myAgentAgent.ts`

4. Edit the generated file and add your logic:

```typescript
async handleCopilotChat(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  try {
    stream.markdown('## My Custom Agent\n\n');
    stream.progress('Processing...');

    // Your custom logic here
    stream.markdown('Hello! I am your custom agent.\n');

    stream.markdown('✅ Done!\n');
  } catch (error) {
    this.logger.error('Error', error);
    stream.markdown(`❌ ${this.formatError(error)}\n`);
  }
}
```

5. Register in `src/extension.ts`:

```typescript
// Add import
import { MyAgentAgent } from './agents/myAgentAgent.js';

// In registerAgents() function:
const myAgent = new MyAgentAgent(
  ctx.vscodeContext,
  ctx.toolRegistry,
  ctx.workflowEngine,
  ctx.config.getConfig(),
  ctx.governanceManager
);
await myAgent.register();
```

6. Update `package.json` to add chat participant:

```json
{
  "contributes": {
    "chatParticipants": [
      {
        "id": "agent.myAgent",
        "name": "myAgent",
        "description": "My first custom agent"
      }
    ]
  }
}
```

7. Reload and test: `@myAgent hello!`

## Your First Workflow

Create a custom workflow that implements Think-Act-Observe.

1. Create `src/workflows/examples/myWorkflow.ts`:

```typescript
import { BaseWorkflow } from '../baseWorkflow.js';
import { Analysis, ActionResult, Observations, AgentRequest } from '../../types/index.js';

export class MyWorkflow extends BaseWorkflow {
  readonly id = 'my_workflow';
  readonly name = 'My Workflow';

  async think(): Promise<Analysis> {
    this.logger.info('Analyzing request...');

    return {
      plan: 'Process the request in 2 steps',
      steps: [
        {
          id: 'step_1',
          description: 'Analyze input',
          requiresApproval: false,
        },
        {
          id: 'step_2',
          description: 'Generate response',
          requiresApproval: false,
        },
      ],
      requiresApproval: false,
      confidence: 0.9,
    };
  }

  async act(analysis: Analysis): Promise<ActionResult[]> {
    this.logger.info('Executing actions...');

    const results: ActionResult[] = [];

    for (const step of analysis.steps) {
      const startTime = Date.now();

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 100));

      results.push({
        stepId: step.id,
        success: true,
        result: { message: `${step.description} completed` },
        duration: Date.now() - startTime,
      });
    }

    return results;
  }

  async observe(actions: ActionResult[]): Promise<Observations> {
    this.logger.info('Observing results...');

    const allSucceeded = this.allActionsSucceeded(actions);

    return {
      success: allSucceeded,
      requiresIteration: false,
      feedback: allSucceeded ? 'All steps completed successfully' : 'Some steps failed',
    };
  }
}
```

2. Register in `src/extension.ts`:

```typescript
// Add import
import { MyWorkflow } from './workflows/examples/myWorkflow.js';

// In registerWorkflows() function:
ctx.workflowEngine.registerWorkflow('my_workflow', (request) => {
  return new MyWorkflow(request, ctx.config.get('debugMode'));
});
```

3. Test: `@agent /execute run my workflow`

## Next Steps

Now that you have the basics:

1. **Read the Architecture Guide**: `docs/ARCHITECTURE.md`
2. **Explore Examples**: Check `src/tools/examples/` and `src/workflows/examples/`
3. **Configure Settings**: Customize in VSCode settings
4. **Add Tests**: Write tests for your components
5. **Join the Community**: GitHub Discussions

## Common Tasks

### Enable Debug Mode

```json
{
  "agentExtension.debugMode": true
}
```

### View Logs

1. View > Output
2. Select "Agent Extension" from dropdown

### Clear State

Command Palette > "Agent: Clear State"

### Update Dependencies

```bash
npm update
```

## Troubleshooting

### Extension Not Loading

- Check VSCode version (must be 1.94.0+)
- Check console for errors: Help > Toggle Developer Tools

### Chat Not Working

- Ensure GitHub Copilot is installed and active
- Check Copilot subscription status

### Build Errors

```bash
# Clean and rebuild
rm -rf node_modules dist out
npm install
npm run compile
```

### Tests Failing

```bash
# Run tests with verbose output
npm run test -- --verbose
```

## Getting Help

- 📖 [Documentation](./docs/)
- 🐛 [Issues](https://github.com/your-org/vscode-agent-extension-starter/issues)
- 💬 [Discussions](https://github.com/your-org/vscode-agent-extension-starter/discussions)

## What's Next?

- Explore advanced workflow patterns
- Implement custom governance rules
- Build a complex multi-agent system
- Integrate with external services
- Publish your extension to the marketplace

Happy coding! 🚀
