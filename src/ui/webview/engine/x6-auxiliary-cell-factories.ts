import { noteHtmlStyleAttributes, sanitizedNoteHtml } from '../components/note-html';
import { noteFoldBackground } from '../components/note-colors';
import type { DiagramImage, DiagramLabel, DiagramLink, DiagramNote } from '../ontology-diagram-types';
import { defaultDiagramLinkIcon, diagramLinkName } from '../components/ontology-diagram-links';
import type { WebviewTheme } from '../webview-theme';
import { borderAttrs, cornerRadius, shadowFilter } from './x6-element-appearance';

export function x6Note(note: DiagramNote, theme: WebviewTheme): Record<string, unknown> {
	const radius = cornerRadius(note.style, theme.noteCornerRadius);
	const noteBackground = note.style?.bg_color ?? theme.noteBackground;

	return {
		id: note.id,
		x: note.x,
		y: note.y,
		width: note.width,
		height: note.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'path', selector: 'foldedCorner' },
			{ tagName: 'rect', selector: 'exportIndicatorBackground' },
			{ tagName: 'text', selector: 'exportIndicatorLabel' },
			{
				tagName: 'foreignObject',
				selector: 'noteContent',
				children: [
					{
						tagName: 'div',
						ns: 'http://www.w3.org/1999/xhtml',
						selector: 'noteHtml',
						attrs: {
							xmlns: 'http://www.w3.org/1999/xhtml',
							class: 'note-html',
						},
					},
				],
			},
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				rx: radius,
				ry: radius,
				fill: noteBackground,
				...borderAttrs(note.style?.border, theme.noteBorder, 1),
				filter: shadowFilter(note.style, theme.elementShadow, theme),
			},
			foldedCorner: {
				d: 'M 0 0 L 14 0 L 14 14 Z',
				refX: '100%',
				refX2: -14,
				refY: 0,
				fill: noteFoldBackground(noteBackground, theme),
				stroke: note.style?.border?.color ?? theme.noteBorder,
				strokeWidth: note.style?.border?.type === 'none' ? 0 : note.style?.border?.weight ?? 1,
				pointerEvents: 'none',
			},
			noteContent: {
				refX: 12,
				refY: 12,
				refWidth: '100%',
				refWidth2: -24,
				refHeight: '100%',
				refHeight2: -24,
				pointerEvents: 'none',
			},
			noteHtml: {
				html: sanitizedNoteHtml(note.text),
				style: noteHtmlStyleAttributes({
					color: note.style?.text_color ?? theme.noteForeground,
					fontFamily: note.style?.font?.family ?? theme.fontFamily,
					fontSize: note.style?.font?.size ?? theme.fontSize,
					bold: note.style?.font?.bold,
					italic: note.style?.font?.italic,
				}),
			},
			...noteExportIndicatorAttrs(note.export !== false, theme),
		},
		zIndex: 40,
	};
}

export function noteExportIndicatorAttrs(exported: boolean, theme: WebviewTheme): Record<string, unknown> {
	const opacity = exported ? 0 : 0.82;

	return {
		exportIndicatorBackground: {
			width: 58,
			height: 16,
			refX: '100%',
			refX2: -66,
			refY: '100%',
			refY2: -22,
			rx: 3,
			ry: 3,
			fill: theme.editorBackground,
			fillOpacity: 0.74,
			stroke: theme.noteBorder,
			strokeOpacity: 0.5,
			strokeWidth: 1,
			opacity,
			pointerEvents: 'none',
		},
		exportIndicatorLabel: {
			text: 'No export',
			refX: '100%',
			refX2: -37,
			refY: '100%',
			refY2: -10,
			textAnchor: 'middle',
			textVerticalAnchor: 'middle',
			fontSize: 9,
			fontWeight: 600,
			fill: theme.noteForeground,
			fillOpacity: 0.8,
			opacity,
			pointerEvents: 'none',
		},
	};
}

export function x6Label(label: DiagramLabel, theme: WebviewTheme): Record<string, unknown> {
	return {
		id: label.id,
		x: label.x,
		y: label.y,
		width: label.width,
		height: label.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'text', selector: 'label' },
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				fill: 'transparent',
				stroke: 'none',
				strokeWidth: 0,
			},
			label: {
				text: label.text,
				fill: label.style?.text_color ?? theme.editorForeground,
				fontFamily: label.style?.font?.family ?? theme.fontFamily,
				fontSize: label.style?.font?.size ?? theme.fontSize,
				fontWeight: label.style?.font?.bold === true ? 700 : 400,
				fontStyle: label.style?.font?.italic === true ? 'italic' : 'normal',
				textAnchor: 'middle',
				textVerticalAnchor: 'middle',
				refX: '50%',
				refY: '50%',
			},
		},
		zIndex: 50,
	};
}

export function x6Image(image: DiagramImage, theme: WebviewTheme): Record<string, unknown> {
	return {
		id: image.id,
		x: image.x,
		y: image.y,
		width: image.width,
		height: image.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'image', selector: 'image' },
			{ tagName: 'rect', selector: 'border' },
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				fill: theme.canvasBackground,
				stroke: 'none',
				strokeWidth: 0,
				filter: shadowFilter(image.style, false, theme),
			},
			image: {
				refWidth: '100%',
				refHeight: '100%',
				'xlink:href': image.source,
				preserveAspectRatio: 'xMidYMid meet',
			},
			border: {
				refWidth: '100%',
				refHeight: '100%',
				fill: 'transparent',
				...borderAttrs(image.style?.border, theme.nodeBorder, 0),
			},
		},
		zIndex: 10,
	};
}

export function x6DiagramLink(link: DiagramLink, theme: WebviewTheme): Record<string, unknown> {
	return {
		id: link.id,
		x: link.x,
		y: link.y,
		width: link.width,
		height: link.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'image', selector: 'icon' },
			{ tagName: 'text', selector: 'label' },
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				fill: 'transparent',
				stroke: 'none',
				strokeWidth: 0,
			},
			icon: {
				width: 52,
				height: 52,
				refX: '50%',
				refX2: -26,
				refY: 12,
				'xlink:href': link.icon ?? defaultDiagramLinkIcon,
				preserveAspectRatio: 'xMidYMid meet',
				pointerEvents: 'none',
			},
			label: {
				text: diagramLinkName(link.diagram_ref),
				fill: theme.editorForeground,
				fontFamily: theme.fontFamily,
				fontSize: theme.fontSize,
				fontWeight: 600,
				textAnchor: 'middle',
				textVerticalAnchor: 'middle',
				refX: '50%',
				refY: '100%',
				refY2: -22,
				pointerEvents: 'none',
			},
		},
		zIndex: 45,
	};
}
