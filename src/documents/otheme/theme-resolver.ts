import { BorderStyle, CommonStyle, EdgeStyle, FontStyle, LabelStyle } from '../odiagram';
import { defaultOntologyDiagramTheme } from './default-theme';
import { CanvasStyle, OntologyDiagramTheme, OntologyDiagramThemeStyleSet } from './otheme-document';

export type OntologyDiagramThemeMode = 'light' | 'dark';

export function resolveOntologyDiagramTheme(activeTheme?: OntologyDiagramTheme, mode?: OntologyDiagramThemeMode): OntologyDiagramTheme {
	const defaultStyleSet = resolveThemeStyleSet(defaultOntologyDiagramTheme, mode);
	const activeStyleSet = resolveThemeStyleSet(activeTheme, mode);
	const merged = mergeThemeStyleSet(defaultStyleSet, activeStyleSet);

	return new OntologyDiagramTheme(
		merged.nodes,
		merged.edges,
		merged.notes,
		merged.labels,
		{},
		{},
		merged.canvas,
	);
}

export function resolveCanvasStyle(activeTheme?: OntologyDiagramTheme, mode?: OntologyDiagramThemeMode): CanvasStyle {
	return resolveOntologyDiagramTheme(activeTheme, mode).canvas ?? new CanvasStyle();
}

export function resolveNodeStyle(activeTheme?: OntologyDiagramTheme, elementStyle?: CommonStyle, mode?: OntologyDiagramThemeMode): CommonStyle {
	return mergeCommonStyle(resolveOntologyDiagramTheme(activeTheme, mode).nodes, elementStyle);
}

export function resolveNoteStyle(activeTheme?: OntologyDiagramTheme, elementStyle?: CommonStyle, mode?: OntologyDiagramThemeMode): CommonStyle {
	return mergeCommonStyle(resolveOntologyDiagramTheme(activeTheme, mode).notes, elementStyle);
}

export function resolveEdgeStyle(activeTheme?: OntologyDiagramTheme, elementStyle?: EdgeStyle, mode?: OntologyDiagramThemeMode): EdgeStyle {
	return mergeEdgeStyle(resolveOntologyDiagramTheme(activeTheme, mode).edges, elementStyle);
}

export function resolveLabelStyle(activeTheme?: OntologyDiagramTheme, elementStyle?: LabelStyle, mode?: OntologyDiagramThemeMode): LabelStyle {
	return mergeLabelStyle(resolveOntologyDiagramTheme(activeTheme, mode).labels, elementStyle);
}

function resolveThemeStyleSet(theme: OntologyDiagramTheme | undefined, mode: OntologyDiagramThemeMode | undefined): OntologyDiagramThemeStyleSet | undefined {
	if (theme === undefined) {
		return undefined;
	}

	return mergeThemeStyleSet(baseThemeStyleSet(theme), mode === undefined ? undefined : theme[mode]);
}

function baseThemeStyleSet(theme: OntologyDiagramTheme): OntologyDiagramThemeStyleSet {
	return new OntologyDiagramThemeStyleSet(
		theme.canvas,
		theme.nodes,
		theme.edges,
		theme.notes,
		theme.labels,
	);
}

function mergeThemeStyleSet(
	base: OntologyDiagramThemeStyleSet | undefined,
	override: OntologyDiagramThemeStyleSet | undefined,
): OntologyDiagramThemeStyleSet {
	return new OntologyDiagramThemeStyleSet(
		mergeCanvasStyle(base?.canvas, override?.canvas),
		mergeCommonStyle(base?.nodes, override?.nodes),
		mergeEdgeStyle(base?.edges, override?.edges),
		mergeCommonStyle(base?.notes, override?.notes),
		mergeLabelStyle(base?.labels, override?.labels),
	);
}

function mergeCanvasStyle(base: CanvasStyle | undefined, override: CanvasStyle | undefined): CanvasStyle | undefined {
	if (base === undefined && override === undefined) {
		return undefined;
	}

	return new CanvasStyle(override?.bgColor ?? base?.bgColor);
}

function mergeCommonStyle(base: CommonStyle | undefined, override: CommonStyle | undefined): CommonStyle {
	return new CommonStyle(
		override?.bgColor ?? base?.bgColor,
		override?.textColor ?? base?.textColor,
		mergeFontStyle(base?.font, override?.font),
		mergeBorderStyle(base?.border, override?.border),
		{},
		override?.cornerRadius ?? base?.cornerRadius,
		override?.shadow ?? base?.shadow,
	);
}

function mergeEdgeStyle(base: EdgeStyle | undefined, override: EdgeStyle | undefined): EdgeStyle {
	return new EdgeStyle(
		override?.color ?? base?.color,
		override?.lineStyle ?? base?.lineStyle,
		override?.weight ?? base?.weight,
		override?.textColor ?? base?.textColor,
		mergeFontStyle(base?.font, override?.font),
	);
}

function mergeLabelStyle(base: LabelStyle | undefined, override: LabelStyle | undefined): LabelStyle {
	return new LabelStyle(
		override?.textColor ?? base?.textColor,
		mergeFontStyle(base?.font, override?.font),
	);
}

function mergeFontStyle(base: FontStyle | undefined, override: FontStyle | undefined): FontStyle | undefined {
	if (base === undefined && override === undefined) {
		return undefined;
	}

	return new FontStyle(
		override?.family ?? base?.family,
		override?.bold ?? base?.bold,
		override?.italic ?? base?.italic,
		override?.size ?? base?.size,
	);
}

function mergeBorderStyle(base: BorderStyle | undefined, override: BorderStyle | undefined): BorderStyle | undefined {
	if (base === undefined && override === undefined) {
		return undefined;
	}

	return new BorderStyle(
		override?.type ?? base?.type,
		override?.weight ?? base?.weight,
		override?.color ?? base?.color,
	);
}
