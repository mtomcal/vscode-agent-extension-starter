#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createAgent() {
  console.log('\n🤖 Agent Extension - Create New Agent\n');

  try {
    // Get agent details
    const name = await question('Agent name (e.g., myAgent): ');
    if (!name || !/^[a-zA-Z0-9-]+$/.test(name)) {
      console.error('❌ Invalid agent name. Use alphanumeric characters and hyphens only.');
      process.exit(1);
    }

    const displayName = await question(`Display name (default: ${name}): `) || name;
    const description = await question('Description: ');

    const type = await question(
      'Agent type (1=chat, 2=command, 3=workflow, 4=hybrid) [1]: '
    );
    const agentType = ['chat', 'command', 'workflow', 'hybrid'][parseInt(type || '1') - 1];

    console.log('\n📦 Select features (comma-separated numbers):');
    console.log('  1. Human-in-the-loop governance');
    console.log('  2. Custom tools');
    console.log('  3. Webview UI');
    console.log('  4. State persistence');
    console.log('  5. Telemetry\n');

    const featuresInput = await question('Features (e.g., 1,2,5) [1,2]: ') || '1,2';
    const selectedFeatures = featuresInput.split(',').map((f) => parseInt(f.trim()));

    const features = {
      hitl: selectedFeatures.includes(1),
      tools: selectedFeatures.includes(2),
      webview: selectedFeatures.includes(3),
      state: selectedFeatures.includes(4),
      telemetry: selectedFeatures.includes(5),
    };

    // Create agent file
    const agentDir = path.join(__dirname, '../src/agents');
    const agentFile = path.join(agentDir, `${name}Agent.ts`);

    if (fs.existsSync(agentFile)) {
      const overwrite = await question(
        `⚠️  Agent file already exists. Overwrite? (y/N): `
      );
      if (overwrite.toLowerCase() !== 'y') {
        console.log('❌ Aborted');
        process.exit(0);
      }
    }

    // Generate agent code
    const agentCode = generateAgentCode(name, displayName, description, agentType, features);
    fs.writeFileSync(agentFile, agentCode);

    console.log(`\n✅ Agent created successfully!`);
    console.log(`\nFile: ${agentFile}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Review the generated agent code`);
    console.log(`  2. Add your custom logic to the agent methods`);
    console.log(`  3. Register the agent in src/extension.ts:`);
    console.log(`     import { ${capitalize(name)}Agent } from './agents/${name}Agent.js';`);
    console.log(`     const agent = new ${capitalize(name)}Agent(...);`);
    console.log(`     await agent.register();`);
    console.log(`  4. Build and test: npm run compile && code .`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

function generateAgentCode(name, displayName, description, type, features) {
  const className = `${capitalize(name)}Agent`;

  return `import * as vscode from 'vscode';
import { BaseAgent } from './baseAgent.js';
import { AgentRequest, AgentResponse } from '../types/index.js';
${features.hitl ? "import { HumanInTheLoopManager } from '../governance/humanInTheLoop.js';\n" : ''}
${features.telemetry ? "import { TelemetryManager } from '../utils/telemetry.js';\n" : ''}

/**
 * ${displayName}
 * ${description}
 */
export class ${className} extends BaseAgent {
  private static readonly PARTICIPANT_ID = 'agent.${name}';

  constructor(
    context: vscode.ExtensionContext,
    toolRegistry: any,
    workflowEngine: any,
    config: any${features.hitl ? ',\n    private governanceManager: HumanInTheLoopManager' : ''}${features.telemetry ? ',\n    private telemetry: TelemetryManager' : ''}
  ) {
    super(context, toolRegistry, workflowEngine, config);
  }

  getName(): string {
    return '${className}';
  }

  async register(): Promise<void> {
    ${
      type === 'chat' || type === 'hybrid'
        ? `const participant = vscode.chat.createChatParticipant(
      ${className}.PARTICIPANT_ID,
      this.handleCopilotChat.bind(this)
    );

    participant.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'media',
      'agent-icon.svg'
    );

    this.logger.info('${className} registered successfully');`
        : `// Register commands or other features here
    this.logger.info('${className} registered successfully');`
    }
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      this.logger.debug(\`Processing request: \${request.id}\`);

      // TODO: Implement your agent logic here
      ${
        features.telemetry
          ? `
      this.telemetry.trackEvent('${name}.request.processed', {
        requestId: request.id,
      });`
          : ''
      }

      return {
        success: true,
        result: {
          message: 'Request processed successfully',
        },
      };
    } catch (error) {
      this.logger.error('Error processing request', error);
      ${
        features.telemetry
          ? `
      this.telemetry.trackError('${name}.request.failed', error.message);`
          : ''
      }
      return {
        success: false,
        error: this.formatError(error),
      };
    }
  }

  async handleCopilotChat(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      stream.markdown('## ${displayName}\\n\\n');
      stream.progress('Processing your request...');

      // TODO: Implement chat handling logic
      ${
        features.hitl
          ? `
      // Example: Request approval for sensitive operations
      // const approved = await this.governanceManager.requestApproval({
      //   type: 'operation',
      //   description: 'Description of the operation',
      //   impact: 'medium',
      //   reversible: true,
      //   details: {},
      // });
      //
      // if (!approved) {
      //   stream.markdown('❌ Operation requires approval but was denied.\\n');
      //   return;
      // }`
          : ''
      }

      stream.markdown('✅ Request completed successfully.\\n');
    } catch (error) {
      this.logger.error('Error in handleCopilotChat', error);
      stream.markdown(\`\\n\\n❌ \${this.formatError(error)}\\n\`);
    }
  }
}
`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Run the script
createAgent();
