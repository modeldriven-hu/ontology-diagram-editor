import { escapeHtml } from '../../../shared/html';

const allowedNoteHtmlTags = new Set([
	'br',
	'p',
	'div',
	'b',
	'strong',
	'i',
	'em',
	'u',
	'code',
	'ul',
	'ol',
	'li',
]);

const droppedNoteHtmlTags = new Set([
	'script',
	'style',
	'template',
	'iframe',
	'object',
	'embed',
	'link',
	'meta',
]);

const voidNoteHtmlTags = new Set(['br']);

export function sanitizedNoteHtml(value: string): string {
	const parsed = new DOMParser().parseFromString(value, 'text/html');
	return [...parsed.body.childNodes].map(sanitizeNode).join('');
}

export function noteHtmlStyle(options: {
	readonly color: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly bold?: boolean;
	readonly italic?: boolean;
}): string {
	return Object.entries(noteHtmlStyleAttributes(options))
		.map(([name, value]) => `${kebabCase(name)}:${name === 'fontFamily' ? escapeCssString(String(value)) : value}`)
		.join(';');
}

export function noteHtmlStyleAttributes(options: {
	readonly color: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly bold?: boolean;
	readonly italic?: boolean;
}): Record<string, string | number> {
	return {
		width: '100%',
		height: '100%',
		margin: 0,
		padding: 0,
		boxSizing: 'border-box',
		overflow: 'hidden',
		whiteSpace: 'pre-wrap',
		overflowWrap: 'anywhere',
		color: options.color,
		fontFamily: options.fontFamily,
		fontSize: `${options.fontSize}px`,
		fontWeight: options.bold === true ? 700 : 400,
		fontStyle: options.italic === true ? 'italic' : 'normal',
		lineHeight: '1.25',
	};
}

export function noteHtmlResetStyle(): string {
	return [
		'.note-html p{margin:0 0 0.5em}',
		'.note-html p:last-child{margin-bottom:0}',
		'.note-html div{margin:0}',
		'.note-html ul,.note-html ol{margin:0 0 0.5em 1.25em;padding:0}',
		'.note-html ul:last-child,.note-html ol:last-child{margin-bottom:0}',
		'.note-html li{margin:0}',
		'.note-html code{font-family:monospace}',
	].join('');
}

function sanitizeNode(node: ChildNode): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return escapeHtml(node.textContent ?? '');
	}
	if (!(node instanceof Element)) {
		return '';
	}

	const tagName = node.tagName.toLowerCase();
	if (droppedNoteHtmlTags.has(tagName)) {
		return '';
	}

	const children = [...node.childNodes].map(sanitizeNode).join('');
	if (!allowedNoteHtmlTags.has(tagName)) {
		return children;
	}
	if (voidNoteHtmlTags.has(tagName)) {
		return `<${tagName}/>`;
	}

	return `<${tagName}>${children}</${tagName}>`;
}

function escapeCssString(value: string): string {
	return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function kebabCase(value: string): string {
	return value.replace(/[A-Z]/gu, (match) => `-${match.toLowerCase()}`);
}
