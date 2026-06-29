import * as assert from 'assert';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { CommonStyle, FontStyle, LabelStyle } from '../odiagram';
import {
	defaultOntologyDiagramTheme,
	OntologyDiagramTheme,
	OntologyDiagramThemeValidationError,
	parseOntologyDiagramThemeYaml,
	readOntologyDiagramThemeFile,
	resolveLabelStyle,
	resolveNodeStyle,
	stringifyOntologyDiagramThemeYaml,
	writeOntologyDiagramThemeFile,
} from '../otheme';

suite('OntologyDiagram theme', () => {
	const validThemeYaml = `
theme:
  nodes:
    bg_color: "#E6F7FF"
    text_color: "#102A43"
    border:
      type: solid
      weight: 1.5
      color: "#1890FF"
    font:
      family: "Arial"
      bold: true
      italic: false
      size: 12
  labels:
    text_color: "rebeccapurple"
`;

	test('parses a partial theme document', () => {
		const theme = parseOntologyDiagramThemeYaml(validThemeYaml);

		assert.strictEqual(theme.nodes?.bgColor, '#E6F7FF');
		assert.strictEqual(theme.nodes?.font?.bold, true);
		assert.strictEqual(theme.edges, undefined);
		assert.strictEqual(theme.labels?.textColor, 'rebeccapurple');
	});

	test('preserves unknown theme fields when serializing', () => {
		const theme = parseOntologyDiagramThemeYaml(`
schema: custom
theme:
  nodes:
    text_color: black
  renderer_hint: compact
`);

		const serialized = stringifyOntologyDiagramThemeYaml(theme);

		assert.match(serialized, /schema: custom/);
		assert.match(serialized, /renderer_hint: compact/);
	});

	test('uses built-in defaults when no active theme is provided', () => {
		const style = resolveNodeStyle();

		assert.strictEqual(style.bgColor, defaultOntologyDiagramTheme.nodes?.bgColor);
		assert.strictEqual(style.font?.family, defaultOntologyDiagramTheme.nodes?.font?.family);
	});

	test('merges default theme, active theme, and element style by field', () => {
		const activeTheme = new OntologyDiagramTheme(
			new CommonStyle(undefined, '#334155', new FontStyle(undefined, true)),
		);
		const elementStyle = new CommonStyle('#F8FAFC', undefined, new FontStyle(undefined, undefined, true));

		const style = resolveNodeStyle(activeTheme, elementStyle);

		assert.strictEqual(style.bgColor, '#F8FAFC');
		assert.strictEqual(style.textColor, '#334155');
		assert.strictEqual(style.font?.family, defaultOntologyDiagramTheme.nodes?.font?.family);
		assert.strictEqual(style.font?.bold, true);
		assert.strictEqual(style.font?.italic, true);
	});

	test('merges label style without adding unsupported label fields', () => {
		const style = resolveLabelStyle(undefined, new LabelStyle('#111827', new FontStyle(undefined, true)));

		assert.strictEqual(style.textColor, '#111827');
		assert.strictEqual(style.font?.family, defaultOntologyDiagramTheme.labels?.font?.family);
		assert.strictEqual(style.font?.bold, true);
	});

	test('rejects unsupported label theme fields', () => {
		assert.throws(
			() => parseOntologyDiagramThemeYaml(`
theme:
  labels:
    bg_color: "#FFFFFF"
`),
			OntologyDiagramThemeValidationError,
		);
	});

	test('rejects invalid color values', () => {
		assert.throws(
			() => parseOntologyDiagramThemeYaml(`
theme:
  nodes:
    text_color: "not a color"
`),
			OntologyDiagramThemeValidationError,
		);
	});

	test('reads and writes theme files', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'otheme-test-'));
		try {
			const sourcePath = path.join(directory, 'default.otheme.yml');
			const targetPath = path.join(directory, 'copy.otheme.yaml');
			await writeFile(sourcePath, validThemeYaml, 'utf8');

			const theme = await readOntologyDiagramThemeFile(sourcePath);
			await writeOntologyDiagramThemeFile(targetPath, theme);
			const content = await readFile(targetPath, 'utf8');

			assert.match(content, /bg_color: "#E6F7FF"/);
			assert.match(content, /text_color: rebeccapurple/);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
