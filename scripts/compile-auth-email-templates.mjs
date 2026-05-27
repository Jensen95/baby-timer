import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const sourcePath = path.resolve('supabase/auth-email-templates.mjml.md');
const outputPath = path.resolve('supabase/auth-email-templates.compiled.md');
const require = createRequire(import.meta.url);
const mjmlBin = require.resolve('mjml/bin/mjml');

function extractTemplates(markdown) {
	const sections = [];
	const sectionMatches = [...markdown.matchAll(/^##\s+(.+)$/gm)];

	for (let index = 0; index < sectionMatches.length; index += 1) {
		const current = sectionMatches[index];
		const next = sectionMatches[index + 1];
		const title = current[1].trim();
		const sectionStart = current.index ?? 0;
		const sectionEnd = next?.index ?? markdown.length;
		const sectionText = markdown.slice(sectionStart, sectionEnd);
		const mjmlMatch = sectionText.match(/```mjml\n([\s\S]*?)\n```/);

		if (mjmlMatch) {
			sections.push({ title, mjml: mjmlMatch[1].trim() });
		}
	}

	return sections;
}

function compileMjml(template) {
	const tempDir = mkdtempSync(path.join(os.tmpdir(), 'baby-timer-mjml-'));
	const inputPath = path.join(tempDir, 'template.mjml');
	writeFileSync(inputPath, template, 'utf8');

	try {
		const result = spawnSync(
			process.execPath,
			[mjmlBin, inputPath, '-s', '--noStdoutFileComment', '--config.validationLevel', 'soft'],
			{
				encoding: 'utf8',
				maxBuffer: 10 * 1024 * 1024
			}
		);

		if (result.error) {
			throw result.error;
		}

		if (result.status !== 0) {
			throw new Error(result.stderr || 'MJML compilation failed');
		}

		return result.stdout.trim();
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}

const source = await readFile(sourcePath, 'utf8');
const sections = extractTemplates(source);

if (sections.length === 0) {
	throw new Error(`No MJML templates found in ${sourcePath}`);
}

const output = [
	'# Supabase Auth Email Templates (compiled HTML)',
	'',
	'This file is generated from `supabase/auth-email-templates.mjml.md`.',
	'Paste each HTML block into the matching Supabase Auth template setting.',
	''
];

for (const section of sections) {
	output.push(`## ${section.title}`);
	output.push('');
	output.push('```html');
	output.push(compileMjml(section.mjml));
	output.push('```');
	output.push('');
}

output.push('## Notes');
output.push('');
output.push('- Regenerate this file after editing the MJML source file.');
output.push('- Supabase Auth stores the pasted HTML and renders it at runtime.');
output.push('');

await writeFile(outputPath, `${output.join('\n')}`);
console.log(`Wrote ${outputPath}`);
