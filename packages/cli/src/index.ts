#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('spec-driven-asteroids')
  .description('Inject Spec Driven standards into your repository')
  .version('0.1.0');

program
  .command('inject')
  .description('Inject platform-specific Spec Driven configs')
  .action(async () => {
    console.log(chalk.bold.cyan('\n☄️ Spec Driven Asteroids: Injecting Intelligence...\n'));

    const { platforms } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'platforms',
        message: 'Select platforms to support:',
        choices: [
          { name: 'GitHub Copilot', value: 'github' },
          { name: 'Google Antigravity', value: 'antigravity' },
          { name: 'OpenCode', value: 'opencode' }
        ],
        validate: (input) => input.length > 0 || 'Select at least one platform.'
      }
    ]);

    const targetDir = process.cwd();
    // Assuming the CLI is run from the dist folder inside packages/cli
    // Templates are in ../../standards/src/templates (during dev)
    // In production, we'd package them differently.
    const standardsDir = path.resolve(__dirname, '../../standards/src/templates');

    for (const platform of platforms) {
      console.log(chalk.yellow(`\nConfiguring ${platform}...`));

      try {
        if (platform === 'github') {
          const src = path.join(standardsDir, 'github');
          const dest = path.join(targetDir, '.github');
          await fs.copy(src, dest, { overwrite: true });
          console.log(chalk.green('✅ GitHub Agents and Skills injected into .github/'));
        }

        if (platform === 'antigravity') {
          const src = path.join(standardsDir, 'antigravity');
          const dest = path.join(targetDir, '.agent');
          await fs.copy(src, dest, { overwrite: true });
          console.log(chalk.green('✅ Antigravity Workflows and Skills injected into .agent/'));
        }

        if (platform === 'opencode') {
          const src = path.join(standardsDir, 'opencode');
          const dest = path.join(targetDir, '.opencode');
          await fs.copy(src, dest, { overwrite: true });
          console.log(chalk.green('✅ OpenCode Skills injected into .opencode/'));
        }
      } catch (err) {
        console.error(chalk.red(`❌ Failed to inject ${platform} config:`, err));
      }
    }

    console.log(chalk.bold.cyan('\n🚀 Injection Complete!'));
    console.log(chalk.white('Next steps:'));
    console.log(chalk.white('1. Ensure your MCP server is running.'));
    console.log(chalk.white('2. Use @spec-planner in Copilot or /spec-driven-feature in Antigravity.\n'));
  });

program
  .command('validate')
  .description('Check if Spec Driven standards are correctly configured')
  .action(async () => {
    const targetDir = process.cwd();
    console.log(chalk.cyan('\n🔍 Validating Spec Driven setup...\n'));

    const checks = [
      { name: 'GitHub Config', path: '.github/agents' },
      { name: 'Antigravity Config', path: '.agent/workflows' },
      { name: 'OpenCode Config', path: '.opencode/skills' },
      { name: 'Standard Requirements', path: 'docs/specs' }
    ];

    for (const check of checks) {
      const exists = await fs.pathExists(path.join(targetDir, check.path));
      if (exists) {
        console.log(`${chalk.green('✅')} ${check.name} found.`);
      } else {
        console.log(`${chalk.gray('➖')} ${check.name} not present (optional).`);
      }
    }

    // Check for MCP connection (placeholder)
    console.log(chalk.yellow('\nTip: Make sure to connect your MCP server to enable structural validation.\n'));
  });

program.parse();
