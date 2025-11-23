#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(command, options = {}) {
  console.log(`\n▶️  ${command}`);
  try {
    execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    throw error;
  }
}

async function setup() {
  console.log('\n🚀 VSCode Agent Extension Starter - Setup\n');

  try {
    // Check if Node.js and npm are installed
    console.log('📋 Checking prerequisites...');
    exec('node --version');
    exec('npm --version');

    // Install dependencies
    console.log('\n📦 Installing dependencies...');
    exec('npm install');

    // Create necessary directories
    console.log('\n📁 Creating directories...');
    const dirs = [
      'src/agents',
      'src/tools/examples',
      'src/workflows/examples',
      'src/governance',
      'src/state',
      'src/ui/webviews',
      'src/ui/bridge',
      'src/utils',
      'media',
      'test/unit',
      'test/integration',
      'docs',
    ];

    for (const dir of dirs) {
      const fullPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`  ✅ Created ${dir}`);
      } else {
        console.log(`  ℹ️  ${dir} already exists`);
      }
    }

    // Build initial version
    console.log('\n🔨 Building extension...');
    exec('npm run compile');

    // Create .vscode directory if it doesn't exist
    const vscodeDir = path.join(__dirname, '..', '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    console.log('\n✅ Setup complete!\n');
    console.log('Next steps:');
    console.log('  1. Open the project in VSCode: code .');
    console.log('  2. Press F5 to launch the Extension Development Host');
    console.log('  3. In the new window, open Copilot Chat and type @agent');
    console.log('  4. Create your first custom agent: npm run create-agent\n');
    console.log('📚 Documentation: See docs/README.md for detailed guides');
    console.log('🤝 Contributing: See CONTRIBUTING.md for guidelines\n');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setup();
