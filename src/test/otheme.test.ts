import * as assert from 'assert';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { CommonStyle, FontStyle, LabelStyle } from '../documents/odiagram';
import {
	defaultOntologyDiagramTheme,
	OntologyDiagramTheme,
	OntologyDiagramThemeValidationError,
	parseOntologyDiagramThemeYaml,
	readOntologyDiagramThemeFile,
	resolveCanvasStyle,
	resolveLabelStyle,
	resolveNodeStyle,
	stringifyOntologyDiagramThemeYaml,
	writeOntologyDiagramThemeFile,
} from '../documents/otheme';

suite('OntologyDiagram theme', () => {
	const validThemeYaml = `
theme:
  canvas:
    bg_color: "#FAFBFC"
  nodes:
    bg_color: "#E6F7FF"
    text_color: "#102A43"
    border:
      type: solid
      weight: 1.5
      color: "#1890FF"
    corner_radius: 10
    shadow: false
    font:
      family: "Arial"
      bold: true
      italic: false
      size: 12
  labels:
    text_color: "rebeccapurple"
  light:
    canvas:
      bg_color: "#FFFFFF"
  dark:
    canvas:
      bg_color: "#111827"
    nodes:
      bg_color: "#1F2937"
      text_color: "#F9FAFB"
    labels:
      text_color: "#F9FAFB"
`;

	test('parses a partial theme document', () => {
		const theme = parseOntologyDiagramThemeYaml(validThemeYaml);

		assert.strictEqual(theme.canvas?.bgColor, '#FAFBFC');
		assert.strictEqual(theme.nodes?.bgColor, '#E6F7FF');
		assert.strictEqual(theme.nodes?.font?.bold, true);
		assert.strictEqual(theme.nodes?.cornerRadius, 10);
		assert.strictEqual(theme.nodes?.shadow, false);
		assert.strictEqual(theme.edges, undefined);
		assert.strictEqual(theme.labels?.textColor, 'rebeccapurple');
		assert.strictEqual(theme.light?.canvas?.bgColor, '#FFFFFF');
		assert.strictEqual(theme.dark?.canvas?.bgColor, '#111827');
		assert.strictEqual(theme.dark?.nodes?.bgColor, '#1F2937');
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
		assert.strictEqual(style.cornerRadius, defaultOntologyDiagramTheme.nodes?.cornerRadius);
		assert.strictEqual(style.shadow, defaultOntologyDiagramTheme.nodes?.shadow);
	});

	test('merges default theme, active theme, and element style by field', () => {
		const activeTheme = new OntologyDiagramTheme(
			new CommonStyle(undefined, '#334155', new FontStyle(undefined, true), undefined, {}, 12, false),
		);
		const elementStyle = new CommonStyle('#F8FAFC', undefined, new FontStyle(undefined, undefined, true), undefined, {}, 4);

		const style = resolveNodeStyle(activeTheme, elementStyle);

		assert.strictEqual(style.bgColor, '#F8FAFC');
		assert.strictEqual(style.textColor, '#334155');
		assert.strictEqual(style.font?.family, defaultOntologyDiagramTheme.nodes?.font?.family);
		assert.strictEqual(style.font?.bold, true);
		assert.strictEqual(style.font?.italic, true);
		assert.strictEqual(style.cornerRadius, 4);
		assert.strictEqual(style.shadow, false);
	});

	test('resolves light and dark theme mode overrides', () => {
		const activeTheme = parseOntologyDiagramThemeYaml(`
theme:
  canvas:
    bg_color: "#EEEEEE"
  nodes:
    text_color: "#222222"
  dark:
    canvas:
      bg_color: "#101010"
    nodes:
      bg_color: "#202020"
`);

		const lightCanvas = resolveCanvasStyle(activeTheme, 'light');
		const darkCanvas = resolveCanvasStyle(activeTheme, 'dark');
		const lightNode = resolveNodeStyle(activeTheme, undefined, 'light');
		const darkNode = resolveNodeStyle(activeTheme, undefined, 'dark');

		assert.strictEqual(lightCanvas.bgColor, '#EEEEEE');
		assert.strictEqual(darkCanvas.bgColor, '#101010');
		assert.strictEqual(lightNode.textColor, '#222222');
		assert.strictEqual(darkNode.textColor, '#222222');
		assert.strictEqual(darkNode.bgColor, '#202020');
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
