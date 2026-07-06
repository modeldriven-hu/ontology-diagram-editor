export interface WebviewTheme {
	readonly canvasBackground: string;
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
		shadowColor: 'rgb(0 0 0 / 16%)',
	};
}

export function detectPreferredThemeMode(): WebviewThemeMode {
	return document.body.classList.contains('vscode-light') ? 'light' : 'dark';
}

interface ThemeModeDefaults {
	readonly canvasBackground: string;
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
}

const lightThemeDefaults: ThemeModeDefaults = {
	canvasBackground: '#FFFFFF',
	edgeColor: '#4A4A4A',
	edgeTextColor: '#000000',
	edgeWeight: 1,
	elementShadow: true,
	editorBackground: '#FFFFFF',
	editorForeground: '#000000',
	nodeBackground: '#FFFFCC',
	nodeBorder: '#333333',
	nodeCornerRadius: 0,
	noteBackground: '#CCFFCC',
	noteBorder: '#669966',
	noteCornerRadius: 0,
	noteFoldBackground: '#B8E6B8',
	noteForeground: '#000000',
};

const darkThemeDefaults: ThemeModeDefaults = {
	canvasBackground: '#111827',
	edgeColor: '#CBD5E1',
	edgeTextColor: '#F9FAFB',
	edgeWeight: 2,
	elementShadow: true,
	editorBackground: '#111827',
	editorForeground: '#F9FAFB',
	nodeBackground: '#1F2937',
	nodeBorder: '#4B5563',
	nodeCornerRadius: 0,
	noteBackground: '#3F371A',
	noteBorder: '#A16207',
	noteCornerRadius: 0,
	noteFoldBackground: '#5A4A1F',
	noteForeground: '#FDE68A',
};

function cssVariable(styles: CSSStyleDeclaration, name: string, fallback: string): string {
	const value = styles.getPropertyValue(name).trim();
	return value.length > 0 ? value : fallback;
}

function mixColorFallback(primary: string, fallback: string): string {
	return primary === fallback ? fallback : primary;
}
