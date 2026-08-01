import type { DiagramElementStyle, DiagramNode } from '../ontology-diagram-types';
import type { WebviewTheme } from '../webview-theme';
import { elementCornerRadius } from '../components/presentation/diagram-presentation';

type ElementBorder = NonNullable<NonNullable<DiagramNode['style']>['border']>;
type ElementStyle = NonNullable<DiagramNode['style']>;

export function borderAttrs(
	border: ElementBorder | undefined,
	defaultColor: string,
	defaultWeight: number,
): Record<string, unknown> {
	const borderType = border?.type;
	const borderWeight = border?.weight;
	const strokeWidth = borderType === 'none' ? 0 : borderWeight ?? defaultWeight;
	const strokeDasharray = borderType === 'dotted'
		? '1 4'
		: borderType === 'dashed'
			? '3 3'
			: undefined;

	return {
		stroke: strokeWidth === 0 ? 'none' : border?.color ?? defaultColor,
		strokeWidth,
		strokeDasharray,
	};
}

export function cornerRadius(style: ElementStyle | undefined, fallback: number): number {
	return elementCornerRadius(style, fallback);
}

export function shadowFilter(style: ElementStyle | undefined, fallback: boolean, theme: WebviewTheme): string {
	return (style?.shadow ?? fallback)
		? `drop-shadow(0 5px 8px ${theme.shadowColor})`
		: 'none';
}
