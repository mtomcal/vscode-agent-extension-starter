# Contributing to VSCode Agent Extension Starter

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/vscode-agent-extension-starter.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Run tests: `npm run test`
6. Commit your changes: `git commit -m "Add your feature"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 20.x or later
- VSCode 1.94.0 or later
- Git

### Installation

```bash
npm run setup
```

This will:
- Install dependencies
- Create necessary directories
- Build the extension
- Configure development environment

### Running the Extension

1. Open the project in VSCode: `code .`
2. Press `F5` to launch the Extension Development Host
3. The extension will be loaded in a new VSCode window
4. Open Copilot Chat and type `@agent` to test

### Development Workflow

1. Make changes to TypeScript files in `src/`
2. The extension will auto-rebuild (if watch mode is running: `npm run watch`)
3. Reload the Extension Development Host (`Ctrl+R` or `Cmd+R`)
4. Test your changes

## Code Style

### TypeScript

We use TypeScript with strict mode enabled. Follow these guidelines:

- Use explicit types for function parameters and return values
- Avoid `any` types when possible
- Use `async/await` for asynchronous operations
- Prefer `const` over `let`, avoid `var`
- Use meaningful variable and function names

### Formatting

We use Prettier for code formatting:

```bash
npm run format        # Format all files
npm run format:check  # Check formatting
```

### Linting

We use ESLint for code linting:

```bash
npm run lint
```

Fix auto-fixable issues:
```bash
npm run lint -- --fix
```

## Testing

### Unit Tests

Write unit tests for individual components:

```typescript
// test/unit/tools/myTool.test.ts
import { expect } from 'chai';
import { MyTool } from '../../../src/tools/myTool.js';

describe('MyTool', () => {
  it('should execute successfully', async () => {
    const tool = new MyTool();
    const result = await tool.execute({ input: 'test' }, mockContext);
    expect(result.success).to.be.true;
  });
});
```

Run unit tests:
```bash
npm run test:unit
```

### Integration Tests

Write integration tests for component interactions:

```typescript
// test/integration/agent.test.ts
describe('Agent Integration', () => {
  it('should process request end-to-end', async () => {
    // Test complete flow
  });
});
```

Run integration tests:
```bash
npm run test:integration
```

## Documentation

### Code Documentation

Use JSDoc comments for public APIs:

```typescript
/**
 * Execute the tool with the given parameters
 * @param parameters - Tool parameters
 * @param context - Execution context
 * @returns Tool result
 */
async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
  // Implementation
}
```

### Markdown Documentation

- Update README.md for user-facing changes
- Update ARCHITECTURE.md for architectural changes
- Add examples to docs/examples/ for new features

## Commit Messages

Follow conventional commits format:

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(tools): add new API tool for HTTP requests

Implements a new tool that makes HTTP requests with support for
various methods, headers, and authentication.

Closes #123
```

```
fix(workflow): handle errors in observe phase

The observe phase was not properly handling errors from failed
actions, causing workflows to crash.

Fixes #456
```

## Pull Request Process

1. **Create an issue first** for significant changes
2. **Branch naming**: Use `feature/`, `fix/`, or `docs/` prefixes
3. **Update tests**: Add/update tests for your changes
4. **Update documentation**: Update relevant documentation
5. **Run checks**: Ensure all tests and linting pass
6. **PR description**: Clearly describe what and why
7. **Link issues**: Reference related issues

### PR Template

```markdown
## Description
[Describe your changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
[Describe how you tested your changes]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No new warnings

## Related Issues
Closes #[issue number]
```

## Project Structure

```
src/
├── agents/         # Agent implementations
├── tools/          # Tool system
├── workflows/      # Workflow engine
├── ui/            # UI components
├── governance/    # Human-in-the-loop
├── state/         # State management
└── utils/         # Utilities

test/
├── unit/          # Unit tests
└── integration/   # Integration tests

docs/              # Documentation
scripts/           # Build and utility scripts
media/             # Icons and assets
```

## Architecture Guidelines

### Adding New Agents

1. Extend `BaseAgent`
2. Implement required methods
3. Add tests
4. Register in `extension.ts`
5. Document usage

### Adding New Tools

1. Extend `BaseTool`
2. Define parameters schema
3. Implement `execute()` method
4. Add tests
5. Register in `extension.ts`
6. Update tool documentation

### Adding New Workflows

1. Extend `BaseWorkflow`
2. Implement Think-Act-Observe
3. Add tests
4. Register with factory
5. Document workflow pattern

## Security Guidelines

1. **Never commit secrets**: Use environment variables
2. **Validate inputs**: Always validate user inputs
3. **Require approval**: Mark sensitive operations
4. **Audit trail**: Log security-relevant operations
5. **Dependencies**: Keep dependencies updated

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions will build and publish

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/your-org/vscode-agent-extension-starter/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/vscode-agent-extension-starter/discussions)
- **Chat**: [Discord Server](https://discord.gg/your-server)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone.

### Our Standards

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards others

### Enforcement

Report violations to [maintainer-email@example.com]

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing! 🎉
