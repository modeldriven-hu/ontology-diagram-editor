export interface WebviewTheme {
	readonly editorBackground: string;
	readonly editorForeground: string;
	readonly focusBorder: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly iconBackground: string;
	readonly nodeBackground: string;
	readonly nodeBorder: string;
	readonly shadowColor: string;
}

export function readTheme(): WebviewTheme {
	const styles = getComputedStyle(document.body);
	const foreground = cssVariable(styles, '--vscode-editor-foreground', '#cccccc');
	const background = cssVariable(styles, '--vscode-editor-background', '#1f1f1f');
	const widgetBackground = cssVariable(styles, '--vscode-editorWidget-background', background);
	const widgetBorder = cssVariable(styles, '--vscode-editorWidget-border', cssVariable(styles, '--vscode-panel-border', '#454545'));

	return {
		editorBackground: background,
		editorForeground: foreground,
		focusBorder: cssVariable(styles, '--vscode-focusBorder', '#007fd4'),
		fontFamily: cssVariable(styles, '--vscode-font-family', 'sans-serif'),
		fontSize: Number.parseInt(cssVariable(styles, '--vscode-font-size', '13'), 10) || 13,
		iconBackground: mixColorFallback(widgetBackground, background),
		nodeBackground: widgetBackground,
		nodeBorder: widgetBorder,
		shadowColor: '#000000',
	};
}

function cssVariable(styles: CSSStyleDeclaration, name: string, fallback: string): string {
	const value = styles.getPropertyValue(name).trim();
	return value.length > 0 ? value : fallback;
}

function mixColorFallback(primary: string, fallback: string): string {
	return primary === fallback ? fallback : primary;
}
