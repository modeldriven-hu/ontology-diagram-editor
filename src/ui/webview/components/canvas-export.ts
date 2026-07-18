import { SaveDiagramExportCommand } from '../../../shared/webview-commands';
import { escapeHtml } from '../../../shared/html';
import type { DiagramEdge, DiagramElementStyle, DiagramImage, DiagramLabel, DiagramLegendElement, DiagramMetadataElement, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import { nodeOntologyLabel, ontologyBackgroundColor, ontologyColor, ontologyColorMode, ontologyLegendEntries, ontologyTextColor } from './ontology-legend';
import { defaultSourceCardinalityLabel, defaultTargetCardinalityLabel, edgeCardinalityLabels } from './edge-cardinality-labels';
import { edgeDisplayName } from './ontology-diagram-edges';
import { nodeAttributeTextLines, nodeAttributeTextOverflow, nodeCompartmentAttributes, nodeDataPropertyLayout, nodeTitleText, visibleNodeAttributeTextLines } from './node-data-properties';
import { noteFoldBackground } from './note-colors';
import { noteHtmlResetStyle, noteHtmlStyle, sanitizedNoteHtml } from './note-html';
import type { WebviewTheme } from '../webview-theme';

type ExportFormat = 'svg' | 'png';

interface DiagramExport {
	readonly svg: string;
	readonly width: number;
	readonly height: number;
	readonly defaultFileName: string;
}

interface ExportBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

interface TextBlockOptions {
	readonly id: string;
	readonly text: string;
	readonly bounds: ExportBounds;
	readonly color: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly bold?: boolean;
	readonly italic?: boolean;
	readonly align: 'left' | 'center';
	readonly verticalAlign: 'top' | 'middle';
	readonly padding: number;
	readonly lineHeight?: number;
	readonly wrap?: boolean;
}

export function renderDiagramExportToolbarIcons(exportSvgButton: HTMLButtonElement, exportPngButton: HTMLButtonElement): void {
	exportSvgButton.replaceChildren(exportTextIcon('SVG'));
	exportPngButton.replaceChildren(exportTextIcon('PNG'));
}

function exportTextIcon(label: string): HTMLSpanElement {
	const icon = document.createElement('span');
	icon.className = 'canvas-action-text-icon';
	icon.setAttribute('aria-hidden', 'true');
	icon.textContent = label;

	return icon;
}

export function createSvgExportCommand(payload: DiagramPayload, theme: WebviewTheme): SaveDiagramExportCommand | undefined {
	const diagramExport = createSvgExport(payload, theme);
	if (diagramExport === undefined) {
		return undefined;
	}

	return new SaveDiagramExportCommand({
		format: 'svg',
		defaultFileName: diagramExport.defaultFileName,
		content: diagramExport.svg,
		encoding: 'utf8',
	});
}

export async function createPngExportCommand(payload: DiagramPayload, theme: WebviewTheme): Promise<SaveDiagramExportCommand | undefined> {
	const diagramExport = createSvgExport(payload, theme);
	if (diagramExport === undefined) {
		return undefined;
	}

	const content = await svgToPngBase64(diagramExport.svg, diagramExport.width, diagramExport.height);

	return new SaveDiagramExportCommand({
		format: 'png',
		defaultFileName: diagramExport.defaultFileName.replace(/\.svg$/u, '.png'),
		content,
		encoding: 'base64',
	});
}

function createSvgExport(payload: DiagramPayload, theme: WebviewTheme): DiagramExport | undefined {
	const diagram = payload.diagram;
	if (diagram === undefined) {
		return undefined;
	}

	const nodes = diagram.nodes ?? [];
	const edges = diagram.edges ?? [];
	const notes = (diagram.notes ?? []).filter((note) => note.export !== false);
	const images = diagram.images ?? [];
	const labels = diagram.labels ?? [];
	const metadataElements = diagram.metadata_elements ?? [];
	const legendElements = diagram.legend_elements ?? [];
	const contentBounds = diagramContentBounds([
		...nodes,
		...edges.flatMap(edgeExportBounds),
		...notes,
		...images,
		...labels,
		...metadataElements,
		...legendElements,
	]);
	if (contentBounds === undefined) {
		return undefined;
	}

	const margin = 24;
	const viewBox = {
		x: contentBounds.x - margin,
		y: contentBounds.y - margin,
		width: contentBounds.width + (margin * 2),
		height: contentBounds.height + (margin * 2),
	};
	const width = Math.ceil(viewBox.width);
	const height = Math.ceil(viewBox.height);
	const svg = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${numberValue(viewBox.x)} ${numberValue(viewBox.y)} ${numberValue(viewBox.width)} ${numberValue(viewBox.height)}">`,
		'<defs>',
		'<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">',
		'<feDropShadow dx="3" dy="3" stdDeviation="1.6" flood-color="#000000" flood-opacity="0.16"/>',
		'</filter>',
		...edges.flatMap((edge) => renderEdgeMarkerDefinitions(edge, payload, theme)),
		'</defs>',
		`<style>${noteHtmlResetStyle()}</style>`,
		`<rect x="${numberValue(viewBox.x)}" y="${numberValue(viewBox.y)}" width="${numberValue(viewBox.width)}" height="${numberValue(viewBox.height)}" fill="${escapeAttribute(theme.canvasBackground)}"/>`,
		...images.map((image) => renderImage(image, theme)),
		...edges.map((edge) => renderEdge(edge, payload, theme)),
		...nodes.map((node) => renderNode(node, payload, theme)),
		...notes.map((note) => renderNote(note, theme)),
		...labels.map((label) => renderLabel(label, theme)),
		...metadataElements.map((element) => renderMetadataElement(element, payload, theme)),
		...legendElements.map((element) => renderLegendElement(element, payload, theme)),
		'</svg>',
	].join('\n');

	return {
		svg,
		width,
		height,
		defaultFileName: `${diagramBaseName(payload)}.svg`,
	};
}

function renderEdge(edge: DiagramEdge, payload: DiagramPayload, theme: WebviewTheme): string {
	const points = edgeRoutePoints(edge);
	if (points.length < 2) {
		return '';
	}

	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	const lineStyle = edge.style?.line_style;
	const stroke = edgeStroke(edge, payload, theme);
	const dashArray = lineStyle === 'dotted'
		? ` stroke-dasharray="${numberValue(strokeWidth)} ${numberValue(strokeWidth * 3)}"`
		: lineStyle === 'dashed'
			? ` stroke-dasharray="${numberValue(strokeWidth * 4)} ${numberValue(strokeWidth * 3)}"`
			: '';
	const marker = lineStyle === 'none' || strokeWidth === 0
		? ''
		: isNoteConnection(edge)
			? ''
		: edge.ontology_item_type === 'subclassRelationship'
			? ` marker-end="url(#${edgeMarkerId(edge, 'hollow-triangle')})"`
			: ` marker-end="url(#${edgeMarkerId(edge, 'open-arrow')})"`;
	const label = isNoteConnection(edge) ? '' : edgeDisplayName(edge.ontology_ref);
	const cardinalities = edgeCardinalityLabels(edge, payload);

	return [
		`<polyline points="${points.map((point) => `${numberValue(point.x)},${numberValue(point.y)}`).join(' ')}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${numberValue(strokeWidth)}"${dashArray}${marker}/>`,
		label.length === 0 ? '' : renderTextBlock({
			id: edge.id,
			text: label,
			bounds: {
				x: edge.label.x,
				y: edge.label.y,
				width: Math.max(80, label.length * 7),
				height: 24,
			},
			color: edge.style?.text_color ?? theme.edgeTextColor,
			fontFamily: edge.style?.font?.family ?? theme.fontFamily,
			fontSize: edge.style?.font?.size ?? Math.max(10, theme.fontSize - 1),
			bold: edge.style?.font?.bold,
			italic: edge.style?.font?.italic,
			align: 'center',
			verticalAlign: 'middle',
			padding: 2,
		}),
		renderEdgeCardinalityLabel(edge, 'source', cardinalities.source, edge.source_cardinality_label ?? defaultSourceCardinalityLabel(points), theme),
		renderEdgeCardinalityLabel(edge, 'target', cardinalities.target, edge.target_cardinality_label ?? defaultTargetCardinalityLabel(points), theme),
	].join('\n');
}

function renderEdgeCardinalityLabel(
	edge: DiagramEdge,
	endpoint: 'source' | 'target',
	text: string | undefined,
	position: { readonly x: number; readonly y: number } | undefined,
	theme: WebviewTheme,
): string {
	if (text === undefined || position === undefined) {
		return '';
	}

	return renderTextBlock({
		id: `${edge.id}_${endpoint}_cardinality`,
		text,
		bounds: { x: position.x, y: position.y, width: Math.max(28, text.length * 7), height: 20 },
		color: edge.style?.text_color ?? theme.edgeTextColor,
		fontFamily: edge.style?.font?.family ?? theme.fontFamily,
		fontSize: Math.max(9, (edge.style?.font?.size ?? theme.fontSize) - 1),
		bold: edge.style?.font?.bold,
		italic: edge.style?.font?.italic,
		align: 'center',
		verticalAlign: 'middle',
		padding: 2,
	});
}

function renderEdgeMarkerDefinitions(edge: DiagramEdge, payload: DiagramPayload, theme: WebviewTheme): readonly string[] {
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	if (edge.style?.line_style === 'none' || strokeWidth === 0) {
		return [];
	}
	if (isNoteConnection(edge)) {
		return [];
	}

	const stroke = edgeStroke(edge, payload, theme);
	if (edge.ontology_item_type === 'subclassRelationship') {
		return [
			`<marker id="${edgeMarkerId(edge, 'hollow-triangle')}" viewBox="0 0 12 10" refX="11" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M 1 1 L 11 5 L 1 9 Z" fill="${escapeAttribute(theme.canvasBackground)}" stroke="${escapeAttribute(stroke)}" stroke-width="${numberValue(strokeWidth)}"/></marker>`,
		];
	}

	return [
		`<marker id="${edgeMarkerId(edge, 'open-arrow')}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${numberValue(strokeWidth)}"/></marker>`,
	];
}

function edgeStroke(edge: DiagramEdge, payload: DiagramPayload, theme: WebviewTheme): string {
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	return edge.style?.line_style === 'none' || strokeWidth === 0 ? 'none' : edge.style?.color ?? ontologyColor(edge.ontology_ref, payload, edge.ontology_item_type) ?? theme.edgeColor;
}

function edgeMarkerId(edge: DiagramEdge, marker: 'hollow-triangle' | 'open-arrow'): string {
	return `${marker}_${safeIdentifier(edge.id)}`;
}

function isNoteConnection(edge: DiagramEdge): boolean {
	return edge.ontology_item_type === 'noteConnection';
}

function renderNode(node: DiagramNode, payload: DiagramPayload, theme: WebviewTheme): string {
	const border = borderStyle(node.style, ontologyColorMode(payload) === 'border' ? ontologyColor(node.ontology_ref, payload, node.ontology_item_type) ?? theme.nodeBorder : theme.nodeBorder, 1);
	const textColor = ontologyTextColor(node.ontology_ref, payload, node.style?.text_color ?? theme.editorForeground, node.ontology_item_type);
	const ontologyLabel = nodeOntologyLabel(node.ontology_ref, payload);
	const fontFamily = node.style?.font?.family ?? theme.nodeFontFamily;
	const fontSize = node.style?.font?.size ?? theme.nodeFontSize;
	const fontBold = node.style?.font?.bold ?? theme.nodeFontBold;
	const fontItalic = node.style?.font?.italic ?? theme.nodeFontItalic;
	const bounds = elementBounds(node);
	if (hasNodeImage(node)) {
		const imageBounds = nodeImageBounds(bounds);
		return [
			`<image href="${escapeAttribute(node.image)}" x="${numberValue(imageBounds.x)}" y="${numberValue(imageBounds.y)}" width="${numberValue(imageBounds.width)}" height="${numberValue(imageBounds.height)}" preserveAspectRatio="${imagePreserveAspectRatio(node)}"/>`,
			renderTextBlock({
				id: node.id,
				text: nodeTitleText(node, payload),
				bounds: { x: bounds.x, y: bounds.y + Math.max(0, bounds.height - 40), width: bounds.width, height: Math.min(32, bounds.height) },
				color: textColor,
				fontFamily,
				fontSize,
				bold: fontBold,
				italic: fontItalic,
				align: 'center',
				verticalAlign: 'middle',
				padding: 10,
			}),
		].join('\n');
	}
	const attributes = nodeCompartmentAttributes(node, payload);
	const hasAttributes = attributes.length > 0;
	const layout = nodeDataPropertyLayout({
		nodeHeight: bounds.height,
		fontSize,
		attributeCount: 0,
	});
	const allAttributeTexts = nodeAttributeTextLines({
		attributes,
		width: bounds.width - 20,
		fontSize: layout.attributeFontSize,
		fontFamily,
		italic: fontItalic,
		textOverflow: nodeAttributeTextOverflow(node),
	});
	const attributeLayout = nodeDataPropertyLayout({
		nodeHeight: bounds.height,
		fontSize,
		attributeCount: allAttributeTexts.length,
	});
	const displayAttributeTexts = visibleNodeAttributeTextLines(allAttributeTexts, attributeLayout.maximumAttributeLines);

	const ontologyLabelPart = ontologyLabel === undefined ? [] : [renderTextBlock({
		id: `${node.id}_ontology`,
		text: ontologyLabel,
		bounds: { x: bounds.x, y: bounds.y + 2, width: bounds.width, height: 16 },
		color: textColor,
		fontFamily,
		fontSize: Math.max(8, fontSize - 3),
		bold: false,
		italic: fontItalic,
		align: 'center',
		verticalAlign: 'middle',
		padding: 4,
	})];
	const parts = [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(node.style, theme.nodeCornerRadius))}" fill="${escapeAttribute(ontologyBackgroundColor(node.ontology_ref, payload, node.style?.bg_color ?? theme.nodeBackground, node.ontology_item_type))}" ${borderAttributes(border)}${shadowAttribute(node.style, theme.elementShadow)}/>`,
		...ontologyLabelPart,
		renderTextBlock({
			id: hasAttributes ? `${node.id}_title` : node.id,
			text: nodeTitleText(node, payload),
			bounds: ontologyLabel === undefined
				? hasAttributes ? { ...bounds, height: layout.headerHeight } : bounds
				: hasAttributes ? { ...bounds, y: bounds.y + 12, height: Math.max(1, layout.headerHeight - 12) } : { ...bounds, y: bounds.y + 12, height: Math.max(1, bounds.height - 12) },
			color: textColor,
			fontFamily,
			fontSize,
			bold: fontBold,
			italic: fontItalic,
			align: 'center',
			verticalAlign: 'middle',
			padding: 10,
		}),
	];

	if (hasAttributes) {
		parts.push(
			`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y + layout.headerHeight)}" width="${numberValue(bounds.width)}" height="1" fill="${escapeAttribute(border.color)}"/>`,
			renderTextBlock({
				id: `${node.id}_attributes`,
				text: displayAttributeTexts.join('\n'),
				bounds: {
					x: bounds.x,
					y: bounds.y + layout.headerHeight + 1,
					width: bounds.width,
					height: Math.max(1, bounds.height - layout.headerHeight - 1),
				},
				color: textColor,
				fontFamily,
				fontSize: attributeLayout.attributeFontSize,
				bold: false,
				italic: fontItalic,
				align: 'left',
				verticalAlign: 'top',
				padding: 10,
				lineHeight: attributeLayout.attributeLineHeight,
				wrap: false,
			}),
		);
	}

	return parts.join('\n');
}

function hasNodeImage(node: DiagramNode): node is DiagramNode & { readonly image: string } {
	return node.image !== undefined && node.image.trim() !== '';
}

function nodeImageBounds(bounds: ExportBounds): ExportBounds {
	return {
		x: bounds.x + 8,
		y: bounds.y + 8,
		width: Math.max(0, bounds.width - 16),
		height: Math.max(0, bounds.height - 56),
	};
}

function imagePreserveAspectRatio(node: DiagramNode): 'xMidYMid meet' | 'xMidYMid slice' | 'xMidYMin slice' | 'xMinYMid slice' {
	switch (node.style?.image_fit) {
		case 'cover':
			return 'xMidYMid slice';
		case 'match_width':
			return 'xMidYMin slice';
		case 'match_height':
			return 'xMinYMid slice';
		default:
			return 'xMidYMid meet';
	}
}

function renderNote(note: DiagramNote, theme: WebviewTheme): string {
	const border = borderStyle(note.style, theme.noteBorder, 1);
	const bounds = elementBounds(note);
	const noteBackground = note.style?.bg_color ?? theme.noteBackground;

	return [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(note.style, theme.noteCornerRadius))}" fill="${escapeAttribute(noteBackground)}" ${borderAttributes(border)}${shadowAttribute(note.style, theme.elementShadow)}/>`,
		renderNoteFold(bounds, border, noteBackground, theme),
		renderNoteHtmlBlock(note, bounds, theme),
	].join('\n');
}

function renderNoteHtmlBlock(note: DiagramNote, bounds: ExportBounds, theme: WebviewTheme): string {
	const padding = 12;
	const x = bounds.x + padding;
	const y = bounds.y + padding;
	const width = Math.max(1, bounds.width - (padding * 2));
	const height = Math.max(1, bounds.height - (padding * 2));
	const style = noteHtmlStyle({
		color: note.style?.text_color ?? theme.noteForeground,
		fontFamily: note.style?.font?.family ?? theme.fontFamily,
		fontSize: note.style?.font?.size ?? theme.fontSize,
		bold: note.style?.font?.bold,
		italic: note.style?.font?.italic,
	});

	return [
		`<foreignObject x="${numberValue(x)}" y="${numberValue(y)}" width="${numberValue(width)}" height="${numberValue(height)}">`,
		`<div xmlns="http://www.w3.org/1999/xhtml" class="note-html" style="${escapeAttribute(style)}">${sanitizedNoteHtml(note.text)}</div>`,
		'</foreignObject>',
	].join('\n');
}

function renderNoteFold(bounds: ExportBounds, border: { readonly color: string; readonly weight: number; readonly type: string | undefined }, noteBackground: string, theme: WebviewTheme): string {
	const size = Math.min(14, bounds.width, bounds.height);
	if (size <= 0) {
		return '';
	}

	const x = bounds.x + bounds.width;
	const y = bounds.y;
	const stroke = border.type === 'none' || border.weight === 0
		? 'none'
		: escapeAttribute(border.color);
	const strokeWidth = border.type === 'none' ? 0 : border.weight;

	return `<path d="M ${numberValue(x - size)} ${numberValue(y)} L ${numberValue(x)} ${numberValue(y)} L ${numberValue(x)} ${numberValue(y + size)} Z" fill="${escapeAttribute(noteFoldBackground(noteBackground, theme))}" stroke="${stroke}" stroke-width="${numberValue(strokeWidth)}"/>`;
}

function renderLabel(label: DiagramLabel, theme: WebviewTheme): string {
	return renderTextBlock({
		id: label.id,
		text: label.text,
		bounds: elementBounds(label),
		color: label.style?.text_color ?? theme.editorForeground,
		fontFamily: label.style?.font?.family ?? theme.fontFamily,
		fontSize: label.style?.font?.size ?? theme.fontSize,
		bold: label.style?.font?.bold,
		italic: label.style?.font?.italic,
		align: 'center',
		verticalAlign: 'middle',
		padding: 4,
	});
}

function renderMetadataElement(element: DiagramMetadataElement, payload: DiagramPayload, theme: WebviewTheme): string {
	const bounds = elementBounds(element);
	const border = borderStyle(element.style, theme.nodeBorder, 1);
	const rowHeight = bounds.height / 3;
	const keyWidth = Math.min(92, Math.max(68, bounds.width * 0.34));
	const fontFamily = element.style?.font?.family ?? theme.fontFamily;
	const fontSize = element.style?.font?.size ?? theme.fontSize;
	const metadata = payload.diagram?.metadata;
	const rows = [
		['Title', metadata?.title ?? ''],
		['Author', (metadata?.authors ?? []).join(', ')],
		['Version', metadata?.diagram_version ?? ''],
	] as const;
	const parts = [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(element.style, theme.nodeCornerRadius))}" fill="${escapeAttribute(element.style?.bg_color ?? theme.nodeBackground)}" ${borderAttributes(border)}${shadowAttribute(element.style, theme.elementShadow)}/>`,
		`<path d="M ${numberValue(bounds.x + keyWidth)} ${numberValue(bounds.y)} V ${numberValue(bounds.y + bounds.height)} M ${numberValue(bounds.x)} ${numberValue(bounds.y + rowHeight)} H ${numberValue(bounds.x + bounds.width)} M ${numberValue(bounds.x)} ${numberValue(bounds.y + rowHeight * 2)} H ${numberValue(bounds.x + bounds.width)}" fill="none" ${borderAttributes(border)}/>`
	];
	rows.forEach((row, index) => {
		const y = bounds.y + rowHeight * index;
		parts.push(renderTextBlock({ id: `${element.id}_key${index}`, text: row[0], bounds: { x: bounds.x, y, width: keyWidth, height: rowHeight }, color: element.style?.text_color ?? theme.editorForeground, fontFamily, fontSize, bold: true, italic: element.style?.font?.italic, align: 'left', verticalAlign: 'middle', padding: 9 }));
		parts.push(renderTextBlock({ id: `${element.id}_value${index}`, text: row[1], bounds: { x: bounds.x + keyWidth, y, width: bounds.width - keyWidth, height: rowHeight }, color: element.style?.text_color ?? theme.editorForeground, fontFamily, fontSize, bold: element.style?.font?.bold, italic: element.style?.font?.italic, align: 'left', verticalAlign: 'middle', padding: 9 }));
	});
	return parts.join('\n');
}

function renderLegendElement(element: DiagramLegendElement, payload: DiagramPayload, theme: WebviewTheme): string {
	const bounds = elementBounds(element);
	const border = borderStyle(element.style, theme.nodeBorder, 1);
	const fontFamily = element.style?.font?.family ?? theme.fontFamily;
	const fontSize = element.style?.font?.size ?? theme.fontSize;
	const entries = ontologyLegendEntries(payload);
	const rowHeight = Math.max(22, (bounds.height - 28) / Math.max(1, entries.length));
	const parts = [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(element.style, theme.nodeCornerRadius))}" fill="${escapeAttribute(element.style?.bg_color ?? theme.nodeBackground)}" ${borderAttributes(border)}${shadowAttribute(element.style, theme.elementShadow)}/>`,
		renderTextBlock({ id: `${element.id}_title`, text: 'Color legend', bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: 28 }, color: element.style?.text_color ?? theme.editorForeground, fontFamily, fontSize, bold: true, italic: element.style?.font?.italic, align: 'left', verticalAlign: 'middle', padding: 10 }),
	];
	entries.forEach((entry, index) => {
		const y = bounds.y + 28 + rowHeight * index;
		parts.push(`<rect x="${numberValue(bounds.x + 10)}" y="${numberValue(y + 4)}" width="14" height="14" rx="2" fill="${escapeAttribute(element.colors[entry.key] ?? theme.nodeBorder)}"/>`);
		parts.push(renderTextBlock({ id: `${element.id}_${index}`, text: entry.label, bounds: { x: bounds.x + 28, y, width: Math.max(1, bounds.width - 36), height: rowHeight }, color: element.style?.text_color ?? theme.editorForeground, fontFamily, fontSize, bold: element.style?.font?.bold, italic: element.style?.font?.italic, align: 'left', verticalAlign: 'middle', padding: 4 }));
	});
	return parts.join('\n');
}

function renderImage(image: DiagramImage, theme: WebviewTheme): string {
	const bounds = elementBounds(image);
	const border = borderStyle(image.style, theme.nodeBorder, 0);

	return [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" fill="${escapeAttribute(theme.canvasBackground)}"${shadowAttribute(image.style, false)}/>`,
		`<image href="${escapeAttribute(image.source)}" x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" preserveAspectRatio="xMidYMid meet"/>`,
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" fill="none" ${borderAttributes(border)}/>`,
	].join('\n');
}

function renderTextBlock(options: TextBlockOptions): string {
	const clipId = `clip_${safeIdentifier(options.id)}`;
	const contentWidth = Math.max(1, options.bounds.width - (options.padding * 2));
	const contentHeight = Math.max(1, options.bounds.height - (options.padding * 2));
	const lineHeight = options.lineHeight ?? options.fontSize * 1.25;
	const lines = options.wrap === false ? explicitLines(options.text) : wrapLines(options.text, contentWidth, options.fontSize);
	const maxLines = Math.max(1, Math.floor(contentHeight / lineHeight));
	const visibleLines = lines.slice(0, maxLines);
	const textX = options.align === 'center' ? options.bounds.x + (options.bounds.width / 2) : options.bounds.x + options.padding;
	const textAnchor = options.align === 'center' ? 'middle' : 'start';
	const textY = options.verticalAlign === 'middle'
		? options.bounds.y + ((options.bounds.height - ((visibleLines.length - 1) * lineHeight)) / 2)
		: options.bounds.y + options.padding + options.fontSize;

	return [
		'<defs>',
		`<clipPath id="${clipId}"><rect x="${numberValue(options.bounds.x)}" y="${numberValue(options.bounds.y)}" width="${numberValue(options.bounds.width)}" height="${numberValue(options.bounds.height)}"/></clipPath>`,
		'</defs>',
		`<text clip-path="url(#${clipId})" x="${numberValue(textX)}" y="${numberValue(textY)}" fill="${escapeAttribute(options.color)}" font-family="${escapeAttribute(options.fontFamily)}" font-size="${numberValue(options.fontSize)}" font-weight="${options.bold === true ? '700' : '400'}" font-style="${options.italic === true ? 'italic' : 'normal'}" text-anchor="${textAnchor}">`,
		...visibleLines.map((line, index) => {
			const dy = index === 0 ? 0 : lineHeight;
			return `<tspan x="${numberValue(textX)}" dy="${numberValue(dy)}">${escapeHtml(line)}</tspan>`;
		}),
		'</text>',
	].join('\n');
}

function borderStyle(style: DiagramElementStyle | undefined, fallbackColor: string, fallbackWeight: number): {
	readonly color: string;
	readonly weight: number;
	readonly type: string | undefined;
} {
	return {
		color: style?.border?.color ?? fallbackColor,
		weight: style?.border?.weight ?? fallbackWeight,
		type: style?.border?.type,
	};
}

function borderAttributes(border: { readonly color: string; readonly weight: number; readonly type: string | undefined }): string {
	if (border.type === 'none' || border.weight === 0) {
		return 'stroke="none" stroke-width="0"';
	}

	const dashArray = border.type === 'dotted'
		? ` stroke-dasharray="${numberValue(border.weight)} ${numberValue(border.weight * 3)}"`
		: border.type === 'dashed'
			? ` stroke-dasharray="${numberValue(border.weight * 4)} ${numberValue(border.weight * 3)}"`
			: '';

	return `stroke="${escapeAttribute(border.color)}" stroke-width="${numberValue(border.weight)}"${dashArray}`;
}

function cornerRadius(style: DiagramElementStyle | undefined, fallback: number): number {
	return style?.corner_radius ?? fallback;
}

function shadowAttribute(style: DiagramElementStyle | undefined, fallback: boolean): string {
	return (style?.shadow ?? fallback) ? ' filter="url(#shadow)"' : '';
}

function wrapLines(text: string, width: number, fontSize: number): readonly string[] {
	const maxCharacters = Math.max(1, Math.floor(width / Math.max(1, fontSize * 0.56)));
	const wrappedLines: string[] = [];
	for (const rawLine of text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')) {
		const words = rawLine.split(/\s+/u).filter((word) => word.length > 0);
		if (words.length === 0) {
			wrappedLines.push('');
			continue;
		}

		let currentLine = '';
		for (const word of words) {
			if (word.length > maxCharacters) {
				if (currentLine.length > 0) {
					wrappedLines.push(currentLine);
					currentLine = '';
				}
				for (let index = 0; index < word.length; index += maxCharacters) {
					wrappedLines.push(word.slice(index, index + maxCharacters));
				}
				continue;
			}

			const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
			if (candidate.length > maxCharacters) {
				wrappedLines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = candidate;
			}
		}
		if (currentLine.length > 0) {
			wrappedLines.push(currentLine);
		}
	}

	return wrappedLines.length === 0 ? [''] : wrappedLines;
}

function explicitLines(text: string): readonly string[] {
	const lines = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');

	return lines.length === 0 ? [''] : lines;
}

function diagramContentBounds(elements: readonly ExportBounds[]): ExportBounds | undefined {
	if (elements.length === 0) {
		return undefined;
	}

	const minX = Math.min(...elements.map((element) => element.x));
	const minY = Math.min(...elements.map((element) => element.y));
	const maxX = Math.max(...elements.map((element) => element.x + element.width));
	const maxY = Math.max(...elements.map((element) => element.y + element.height));

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

function edgeExportBounds(edge: DiagramEdge): readonly ExportBounds[] {
	const pointBounds = edgeRoutePoints(edge).map((point) => ({
		x: point.x,
		y: point.y,
		width: 1,
		height: 1,
	}));

	return [
		...pointBounds,
		...(isNoteConnection(edge) ? [] : [
		{
			x: edge.label.x,
			y: edge.label.y,
			width: Math.max(80, edgeDisplayName(edge.ontology_ref).length * 7),
			height: 24,
		},
		]),
	];
}

function edgeRoutePoints(edge: DiagramEdge): readonly { readonly x: number; readonly y: number }[] {
	if (edge.points.length < 2) {
		return [];
	}
	if (edge.route_layout === 'direct') {
		return [edge.points[0], edge.points[edge.points.length - 1]];
	}

	return edge.points;
}

function elementBounds(element: ExportBounds): ExportBounds {
	return {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
	};
}

function svgToPngBase64(svg: string, width: number, height: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener('load', () => {
			const canvas = document.createElement('canvas');
			const exportScale = Math.max(2, window.devicePixelRatio || 1);
			canvas.width = Math.ceil(width * exportScale);
			canvas.height = Math.ceil(height * exportScale);
			const context = canvas.getContext('2d');
			if (context === null) {
				reject(new Error('Could not create PNG export canvas.'));
				return;
			}

			context.scale(exportScale, exportScale);
			context.drawImage(image, 0, 0, width, height);
			resolve(canvas.toDataURL('image/png').split(',')[1] ?? '');
		});
		image.addEventListener('error', () => {
			reject(new Error('Could not render the diagram SVG as PNG.'));
		});
		image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	});
}

function plainText(value: string): string {
	if (!/<[a-z][\s\S]*>/iu.test(value)) {
		return value;
	}

	const element = document.createElement('div');
	element.innerHTML = value;
	return element.textContent ?? value;
}

function diagramBaseName(payload: DiagramPayload): string {
	const filePath = payload.file?.fsPath;
	const fileName = filePath?.split(/[\\/]/u).pop() ?? payload.diagram?.metadata?.title ?? 'ontology-diagram';
	const withoutExtension = fileName.replace(/\.odiagram$/iu, '');
	const safeName = withoutExtension.replace(/[^A-Za-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '');

	return safeName.length > 0 ? safeName : 'ontology-diagram';
}

function safeIdentifier(value: string): string {
	return value.replace(/[^A-Za-z0-9_-]/gu, '_');
}

function numberValue(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/u, '');
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replaceAll('"', '&quot;');
}
