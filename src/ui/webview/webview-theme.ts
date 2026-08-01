export interface WebviewTheme {
	readonly canvasBackground: string;
	readonly containmentBackgrounds: readonly string[];
	readonly containmentBorders: readonly string[];
	readonly edgeColor: string;
	readonly edgeTextColor: string;
	readonly edgeWeight: number;
	readonly elementShadow: boolean;
	readonly editorBackground: string;
	readonly editorForeground: string;
	readonly focusBorder: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly iconBackground: string;
	readonly nodeBackground: string;
	readonly nodeBorder: string;
	readonly nodeCornerRadius: number;
	readonly nodeFontBold: boolean;
	readonly nodeFontFamily: string;
	readonly nodeFontItalic: boolean;
	readonly nodeFontSize: number;
	readonly noteBackground: string;
	readonly noteBorder: string;
	readonly noteCornerRadius: number;
	readonly noteFoldBackground: string;
	readonly noteForeground: string;
	readonly shadowColor: string;
}

export type WebviewThemeMode = 'light' | 'dark';

export interface WebviewThemeOverrides {
	readonly nodeFontBold?: boolean;
	readonly nodeFontFamily?: string;
	readonly nodeFontItalic?: boolean;
	readonly nodeFontSize?: number;
}

export type WebviewThemeOverrideMap = Partial<Record<WebviewThemeMode, WebviewThemeOverrides>>;

export function readTheme(mode: WebviewThemeMode = detectPreferredThemeMode(), overrides?: WebviewThemeOverrideMap): WebviewTheme {
	const styles = getComputedStyle(document.body);
	const background = cssVariable(styles, '--vscode-editor-background', '#1f1f1f');
	const widgetBackground = cssVariable(styles, '--vscode-editorWidget-background', background);
	const modeDefaults = mode === 'dark' ? darkThemeDefaults : lightThemeDefaults;
	const modeOverrides = overrides?.[mode];
	const defaultFontFamily = cssVariable(styles, '--vscode-font-family', 'sans-serif');
	const defaultFontSize = Number.parseInt(cssVariable(styles, '--vscode-font-size', '13'), 10) || 13;

	return {
		canvasBackground: modeDefaults.canvasBackground,
		containmentBackgrounds: modeDefaults.containmentBackgrounds,
		containmentBorders: modeDefaults.containmentBorders,
		edgeColor: modeDefaults.edgeColor,
		edgeTextColor: modeDefaults.edgeTextColor,
		edgeWeight: modeDefaults.edgeWeight,
		elementShadow: modeDefaults.elementShadow,
		editorBackground: modeDefaults.editorBackground,
		editorForeground: modeDefaults.editorForeground,
		focusBorder: cssVariable(styles, '--vscode-focusBorder', '#007fd4'),
		fontFamily: defaultFontFamily,
		fontSize: defaultFontSize,
		iconBackground: mixColorFallback(widgetBackground, background),
		nodeBackground: modeDefaults.nodeBackground,
		nodeBorder: modeDefaults.nodeBorder,
		nodeCornerRadius: modeDefaults.nodeCornerRadius,
		nodeFontBold: modeOverrides?.nodeFontBold ?? false,
		nodeFontFamily: modeOverrides?.nodeFontFamily ?? defaultFontFamily,
		nodeFontItalic: modeOverrides?.nodeFontItalic ?? false,
		nodeFontSize: modeOverrides?.nodeFontSize ?? defaultFontSize,
		noteBackground: modeDefaults.noteBackground,
		noteBorder: modeDefaults.noteBorder,
		noteCornerRadius: modeDefaults.noteCornerRadius,
		noteFoldBackground: modeDefaults.noteFoldBackground,
		noteForeground: modeDefaults.noteForeground,
		shadowColor: modeDefaults.shadowColor,
	};
}

export function detectPreferredThemeMode(): WebviewThemeMode {
	return document.body.classList.contains('vscode-light') ? 'light' : 'dark';
}

interface ThemeModeDefaults {
	readonly canvasBackground: string;
	readonly containmentBackgrounds: readonly string[];
	readonly containmentBorders: readonly string[];
	readonly edgeColor: string;
	readonly edgeTextColor: string;
	readonly edgeWeight: number;
	readonly elementShadow: boolean;
	readonly editorBackground: string;
	readonly editorForeground: string;
	readonly nodeBackground: string;
	readonly nodeBorder: string;
	readonly nodeCornerRadius: number;
	readonly noteBackground: string;
	readonly noteBorder: string;
	readonly noteCornerRadius: number;
	readonly noteFoldBackground: string;
	readonly noteForeground: string;
	readonly shadowColor: string;
}

const lightThemeDefaults: ThemeModeDefaults = {
	canvasBackground: '#F5F7FA',
	containmentBackgrounds: ['#EDF4FF', '#F4F7FB', '#F0F9F7', '#F7F4FC'],
	containmentBorders: ['#9BB8DE', '#BAC6D6', '#9ECFC4', '#C5B4DD'],
	edgeColor: '#8795A8',
	edgeTextColor: '#475569',
	edgeWeight: 1.25,
	elementShadow: true,
	editorBackground: '#F5F7FA',
	editorForeground: '#1E293B',
	nodeBackground: '#FFFFFF',
	nodeBorder: '#CBD5E1',
	nodeCornerRadius: 8,
	noteBackground: '#FFF8DC',
	noteBorder: '#E7CA72',
	noteCornerRadius: 8,
	noteFoldBackground: '#F5DFA0',
	noteForeground: '#493D1F',
	shadowColor: 'rgb(15 23 42 / 12%)',
};

const darkThemeDefaults: ThemeModeDefaults = {
	canvasBackground: '#0F172A',
	containmentBackgrounds: ['#252A47', '#18383A', '#172F43', '#2B2540'],
	containmentBorders: ['#818CF8', '#2DD4BF', '#38BDF8', '#A78BFA'],
	edgeColor: '#94A3B8',
	edgeTextColor: '#E2E8F0',
	edgeWeight: 1.5,
	elementShadow: true,
	editorBackground: '#0F172A',
	editorForeground: '#F1F5F9',
	nodeBackground: '#1E293B',
	nodeBorder: '#475569',
	nodeCornerRadius: 0,
	noteBackground: '#292524',
	noteBorder: '#78716C',
	noteCornerRadius: 0,
	noteFoldBackground: '#3F3A38',
	noteForeground: '#FDE68A',
	shadowColor: 'rgb(0 0 0 / 38%)',
};

export function containmentColorAtDepth(palette: readonly string[], depth: number, fallback: string): string {
	if (palette.length === 0) {
		return fallback;
	}
	return palette[Math.max(0, Math.floor(depth)) % palette.length] ?? fallback;
}

function cssVariable(styles: CSSStyleDeclaration, name: string, fallback: string): string {
	const value = styles.getPropertyValue(name).trim();
	return value.length > 0 ? value : fallback;
}

function mixColorFallback(primary: string, fallback: string): string {
	return primary === fallback ? fallback : primary;
}
