import { FileCode, ImageDown, createElement as createIconElement } from 'lucide';

import { SaveDiagramExportCommand } from '../../../shared/webview-commands';
import { escapeHtml } from '../../../shared/html';
import type { DiagramEdge, DiagramElementStyle, DiagramImage, DiagramLabel, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import { edgeDisplayName } from './ontology-diagram-edges';
import type { WebviewTheme } from '../webview-theme';

type ExportFormat = 'svg' | 'png';
type ImageHrefMode = 'source' | 'webview';

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
}

export function renderDiagramExportToolbarIcons(exportSvgButton: HTMLButtonElement, exportPngButton: HTMLButtonElement): void {
	exportSvgButton.replaceChildren(createIconElement(FileCode, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	exportPngButton.replaceChildren(createIconElement(ImageDown, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
}

export function createSvgExportCommand(payload: DiagramPayload, theme: WebviewTheme): SaveDiagramExportCommand | undefined {
	const diagramExport = createSvgExport(payload, theme, 'source');
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
	const diagramExport = createSvgExport(payload, theme, 'webview');
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

function createSvgExport(payload: DiagramPayload, theme: WebviewTheme, imageHrefMode: ImageHrefMode): DiagramExport | undefined {
	const diagram = payload.diagram;
	if (diagram === undefined) {
		return undefined;
	}

	const nodes = diagram.nodes ?? [];
	const edges = diagram.edges ?? [];
	const notes = diagram.notes ?? [];
	const images = diagram.images ?? [];
	const labels = diagram.labels ?? [];
	const contentBounds = diagramContentBounds([
		...nodes,
		...edges.flatMap(edgeExportBounds),
		...notes,
		...images,
		...labels,
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
		'<feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.18"/>',
		'</filter>',
		...edges.flatMap((edge) => renderEdgeMarkerDefinitions(edge, theme)),
		'</defs>',
		`<rect x="${numberValue(viewBox.x)}" y="${numberValue(viewBox.y)}" width="${numberValue(viewBox.width)}" height="${numberValue(viewBox.height)}" fill="${escapeAttribute(theme.editorBackground)}"/>`,
		...images.map((image) => renderImage(image, theme, imageHrefMode)),
		...edges.map((edge) => renderEdge(edge, theme)),
		...nodes.map((node) => renderNode(node, theme)),
		...notes.map((note) => renderNote(note, theme)),
		...labels.map((label) => renderLabel(label, theme)),
		'</svg>',
	].join('\n');

	return {
		svg,
		width,
		height,
		defaultFileName: `${diagramBaseName(payload)}.svg`,
	};
}

function renderEdge(edge: DiagramEdge, theme: WebviewTheme): string {
	const points = edge.points.length >= 2 ? edge.points : [];
	if (points.length < 2) {
		return '';
	}

	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	const lineStyle = edge.style?.line_style;
	const stroke = edgeStroke(edge, theme);
	const dashArray = lineStyle === 'dotted'
		? ` stroke-dasharray="${numberValue(strokeWidth)} ${numberValue(strokeWidth * 3)}"`
		: lineStyle === 'dashed'
			? ` stroke-dasharray="${numberValue(strokeWidth * 4)} ${numberValue(strokeWidth * 3)}"`
			: '';
	const marker = lineStyle === 'none' || strokeWidth === 0
		? ''
		: edge.ontology_item_type === 'subclassRelationship'
			? ` marker-end="url(#${edgeMarkerId(edge, 'hollow-triangle')})"`
			: ` marker-end="url(#${edgeMarkerId(edge, 'open-arrow')})"`;

	return [
		`<polyline points="${points.map((point) => `${numberValue(point.x)},${numberValue(point.y)}`).join(' ')}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${numberValue(strokeWidth)}"${dashArray}${marker}/>`,
		renderTextBlock({
			id: edge.id,
			text: edgeDisplayName(edge.ontology_ref),
			bounds: {
				x: edge.label.x,
				y: edge.label.y,
				width: Math.max(80, edgeDisplayName(edge.ontology_ref).length * 7),
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
	].join('\n');
}

function renderEdgeMarkerDefinitions(edge: DiagramEdge, theme: WebviewTheme): readonly string[] {
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	if (edge.style?.line_style === 'none' || strokeWidth === 0) {
		return [];
	}

	const stroke = edgeStroke(edge, theme);
	if (edge.ontology_item_type === 'subclassRelationship') {
		return [
			`<marker id="${edgeMarkerId(edge, 'hollow-triangle')}" viewBox="0 0 12 10" refX="11" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M 1 1 L 11 5 L 1 9 Z" fill="${escapeAttribute(theme.editorBackground)}" stroke="${escapeAttribute(stroke)}" stroke-width="${numberValue(strokeWidth)}"/></marker>`,
		];
	}

	return [
		`<marker id="${edgeMarkerId(edge, 'open-arrow')}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${numberValue(strokeWidth)}"/></marker>`,
	];
}

function edgeStroke(edge: DiagramEdge, theme: WebviewTheme): string {
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	return edge.style?.line_style === 'none' || strokeWidth === 0 ? 'none' : edge.style?.color ?? theme.edgeColor;
}

function edgeMarkerId(edge: DiagramEdge, marker: 'hollow-triangle' | 'open-arrow'): string {
	return `${marker}_${safeIdentifier(edge.id)}`;
}

function renderNode(node: DiagramNode, theme: WebviewTheme): string {
	const border = borderStyle(node.style, theme.nodeBorder, 1);
	const fontSize = node.style?.font?.size ?? theme.fontSize;
	const bounds = elementBounds(node);

	return [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="8" fill="${escapeAttribute(node.style?.bg_color ?? theme.nodeBackground)}" ${borderAttributes(border)} filter="url(#shadow)"/>`,
		renderTextBlock({
			id: node.id,
			text: displayName(node.ontology_ref),
			bounds,
			color: node.style?.text_color ?? theme.editorForeground,
			fontFamily: node.style?.font?.family ?? theme.fontFamily,
			fontSize,
			bold: node.style?.font?.bold,
			italic: node.style?.font?.italic,
			align: 'center',
			verticalAlign: 'middle',
			padding: 10,
		}),
	].join('\n');
}

function renderNote(note: DiagramNote, theme: WebviewTheme): string {
	const border = borderStyle(note.style, '#d7b85d', 1);
	const bounds = elementBounds(note);

	return [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="6" fill="${escapeAttribute(note.style?.bg_color ?? '#fff4b8')}" ${borderAttributes(border)} filter="url(#shadow)"/>`,
		renderTextBlock({
			id: note.id,
			text: plainText(note.text),
			bounds,
			color: note.style?.text_color ?? '#3b2f00',
			fontFamily: note.style?.font?.family ?? theme.fontFamily,
			fontSize: note.style?.font?.size ?? theme.fontSize,
			bold: note.style?.font?.bold,
			italic: note.style?.font?.italic,
			align: 'left',
			verticalAlign: 'top',
			padding: 12,
		}),
	].join('\n');
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

function renderImage(image: DiagramImage, theme: WebviewTheme, imageHrefMode: ImageHrefMode): string {
	const bounds = elementBounds(image);
	const href = imageHrefMode === 'webview' ? image.webview_src : image.source;

	return [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" fill="${escapeAttribute(theme.editorBackground)}" stroke="${escapeAttribute(theme.nodeBorder)}" stroke-width="1" filter="url(#shadow)"/>`,
		`<image href="${escapeAttribute(href)}" x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" preserveAspectRatio="xMidYMid meet"/>`,
	].join('\n');
}

function renderTextBlock(options: TextBlockOptions): string {
	const clipId = `clip_${safeIdentifier(options.id)}`;
	const contentWidth = Math.max(1, options.bounds.width - (options.padding * 2));
	const contentHeight = Math.max(1, options.bounds.height - (options.padding * 2));
	const lineHeight = options.fontSize * 1.25;
	const lines = wrapLines(options.text, contentWidth, options.fontSize);
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
	const pointBounds = edge.points.map((point) => ({
		x: point.x,
		y: point.y,
		width: 1,
		height: 1,
	}));

	return [
		...pointBounds,
		{
			x: edge.label.x,
			y: edge.label.y,
			width: Math.max(80, edgeDisplayName(edge.ontology_ref).length * 7),
			height: 24,
		},
	];
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

function displayName(ontologyRef: string): string {
	const hashIndex = ontologyRef.lastIndexOf('#');
	const slashIndex = ontologyRef.lastIndexOf('/');
	const compactIriIndex = ontologyRef.includes('://') ? -1 : ontologyRef.lastIndexOf(':');
	const separatorIndex = Math.max(hashIndex, slashIndex, compactIriIndex);
	const name = separatorIndex >= 0 ? ontologyRef.slice(separatorIndex + 1) : ontologyRef;

	return name.length > 0 ? name : ontologyRef;
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
