#!/usr/bin/env tsx
/**
 * Validates that skill template file names match the `name:` field in their frontmatter.
 *
 * This validation ensures that GitHub Copilot and other AI assistants can correctly
 * identify and load skills by their name.
 *
 * Usage: pnpm run validate:skills
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const SKILLS_DIR = join(__dirname, '../src/resources/templates/skills');

interface ValidationResult {
    file: string;
    expectedName: string;
    actualName: string | null;
    valid: boolean;
    error?: string;
}

function extractFrontmatterName(content: string): string | null {
    // Match YAML frontmatter between --- delimiters
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
        return null;
    }

    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (!nameMatch) {
        return null;
    }

    return nameMatch[1].trim();
}

function validateSkillTemplates(): ValidationResult[] {
    const results: ValidationResult[] = [];

    const files = readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));

    for (const file of files) {
        const filePath = join(SKILLS_DIR, file);
        const content = readFileSync(filePath, 'utf-8');

        // Expected name is the filename without .md extension
        const expectedName = basename(file, '.md');
        const actualName = extractFrontmatterName(content);

        if (actualName === null) {
            results.push({
                file,
                expectedName,
                actualName: null,
                valid: false,
                error: 'Missing or invalid frontmatter name field',
            });
        } else if (actualName !== expectedName) {
            results.push({
                file,
                expectedName,
                actualName,
                valid: false,
                error: `Name mismatch: file is "${expectedName}" but frontmatter says "${actualName}"`,
            });
        } else {
            results.push({
                file,
                expectedName,
                actualName,
                valid: true,
            });
        }
    }

    return results;
}

function main(): void {
    console.log('Validating skill templates...\n');

    const results = validateSkillTemplates();
    const failures = results.filter(r => !r.valid);
    const successes = results.filter(r => r.valid);

    for (const result of successes) {
        console.log(`✅ ${result.file} -> name: ${result.actualName}`);
    }

    if (failures.length > 0) {
        console.log('\n❌ Validation failures:\n');
        for (const failure of failures) {
            console.log(`  ${failure.file}:`);
            console.log(`    Expected: ${failure.expectedName}`);
            console.log(`    Actual:   ${failure.actualName ?? '(none)'}`);
            console.log(`    Error:    ${failure.error}\n`);
        }

        console.log(`\n${failures.length} of ${results.length} skills failed validation.`);
        console.log('\nTo fix: Ensure the filename (without .md) matches the `name:` field in the frontmatter.');
        process.exit(1);
    }

    console.log(`\n✅ All ${results.length} skill templates are valid.`);
}

main();
