import type { DiagramPayload } from '../ontology-diagram-types';
import type { WebviewTheme } from '../webview-theme';

export function diagramPresentationTheme(theme: WebviewTheme, payload: DiagramPayload): WebviewTheme {
	const background = payload.diagram?.metadata?.canvas_background ?? 'theme';
	if (background === 'theme') {
		return theme;
	}

	return {
		...theme,
		canvasBackground: background === 'white'
			? theme.mode === 'dark' ? '#000000' : '#FFFFFF'
			: 'transparent',
	};
}

export function diagramGridIsVisible(payload: DiagramPayload): boolean {
	return payload.diagram?.metadata?.show_grid !== false;
}
