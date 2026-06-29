import { BorderStyle, CommonStyle, EdgeStyle, FontStyle, LabelStyle } from '../odiagram';
import { defaultOntologyDiagramTheme } from './default-theme';
import { OntologyDiagramTheme } from './otheme-document';

export function resolveOntologyDiagramTheme(activeTheme?: OntologyDiagramTheme): OntologyDiagramTheme {
	return new OntologyDiagramTheme(
		mergeCommonStyle(defaultOntologyDiagramTheme.nodes, activeTheme?.nodes),
		mergeEdgeStyle(defaultOntologyDiagramTheme.edges, activeTheme?.edges),
		mergeCommonStyle(defaultOntologyDiagramTheme.notes, activeTheme?.notes),
		mergeLabelStyle(defaultOntologyDiagramTheme.labels, activeTheme?.labels),
	);
}

export function resolveNodeStyle(activeTheme?: OntologyDiagramTheme, elementStyle?: CommonStyle): CommonStyle {
	return mergeCommonStyle(resolveOntologyDiagramTheme(activeTheme).nodes, elementStyle);
}

export function resolveNoteStyle(activeTheme?: OntologyDiagramTheme, elementStyle?: CommonStyle): CommonStyle {
	return mergeCommonStyle(resolveOntologyDiagramTheme(activeTheme).notes, elementStyle);
}

export function resolveEdgeStyle(activeTheme?: OntologyDiagramTheme, elementStyle?: EdgeStyle): EdgeStyle {
	return mergeEdgeStyle(resolveOntologyDiagramTheme(activeTheme).edges, elementStyle);
}

export function resolveLabelStyle(activeTheme?: OntologyDiagramTheme, elementStyle?: LabelStyle): LabelStyle {
	return mergeLabelStyle(resolveOntologyDiagramTheme(activeTheme).labels, elementStyle);
}

function mergeCommonStyle(base: CommonStyle | undefined, override: CommonStyle | undefined): CommonStyle {
	return new CommonStyle(
		override?.bgColor ?? base?.bgColor,
		override?.textColor ?? base?.textColor,
		mergeFontStyle(base?.font, override?.font),
		mergeBorderStyle(base?.border, override?.border),
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
