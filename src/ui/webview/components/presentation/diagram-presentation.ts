import { nodeImageInset, nodeImageReservedHeight } from '../../../../shared/canvas-geometry';
import type { DiagramEdge, DiagramElementStyle, DiagramNode } from '../../ontology-diagram-types';

export interface ImagePresentationBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface ImagePresentation {
	readonly bounds: ImagePresentationBounds;
	readonly preserveAspectRatio: 'xMidYMid meet' | 'xMidYMid slice';
}

export function nodeImageViewport(node: DiagramNode): ImagePresentationBounds {
	const fit = node.style?.image_fit ?? 'contain';
	return {
		x: fit === 'match_width' ? 0 : nodeImageInset,
		y: nodeImageInset,
		width: Math.max(0, fit === 'match_width' ? node.width : node.width - (nodeImageInset * 2)),
		height: Math.max(0, node.height - nodeImageReservedHeight),
	};
}

export function nodeImagePresentation(node: DiagramNode, viewport: ImagePresentationBounds): ImagePresentation {
	const fit = node.style?.image_fit ?? 'contain';
	if (fit !== 'match_width' && fit !== 'match_height') {
		return {
			bounds: viewport,
			preserveAspectRatio: fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet',
		};
	}

	const dimensions = embeddedImageDimensions(node.image);
	const aspectRatio = dimensions === undefined ? 1 : dimensions.width / dimensions.height;
	if (fit === 'match_width') {
		return {
			bounds: {
				x: viewport.x,
				y: viewport.y,
				width: viewport.width,
				height: viewport.width / aspectRatio,
			},
			preserveAspectRatio: 'xMidYMid meet',
		};
	}

	const width = viewport.height * aspectRatio;
	return {
		bounds: {
			x: viewport.x + ((viewport.width - width) / 2),
			y: viewport.y,
			width,
			height: viewport.height,
		},
		preserveAspectRatio: 'xMidYMid meet',
	};
}

function embeddedImageDimensions(source: string | undefined): { readonly width: number; readonly height: number } | undefined {
	if (source === undefined) {
		return undefined;
	}
	const match = source.match(/^data:(image\/[^;,]+)((?:;[^,]*)*),(.*)$/is);
	if (match === null) {
		return undefined;
	}

	const mimeType = match[1].toLocaleLowerCase();
	const encoded = match[3];
	try {
		if (mimeType === 'image/svg+xml') {
			const svg = match[2].toLocaleLowerCase().includes(';base64')
				? new TextDecoder().decode(base64Bytes(encoded))
				: decodeURIComponent(encoded);
			return svgDimensions(svg);
		}

		if (!match[2].toLocaleLowerCase().includes(';base64')) {
			return undefined;
		}
		const bytes = base64Bytes(encoded);
		if (mimeType === 'image/png') {
			return pngDimensions(bytes);
		}
		if (mimeType === 'image/gif') {
			return gifDimensions(bytes);
		}
		if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
			return jpegDimensions(bytes);
		}
		if (mimeType === 'image/webp') {
			return webpDimensions(bytes);
		}
		if (mimeType === 'image/bmp') {
			return bmpDimensions(bytes);
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function svgDimensions(svg: string): { readonly width: number; readonly height: number } | undefined {
	const root = svg.match(/<svg\b[^>]*>/i)?.[0];
	if (root === undefined) {
		return undefined;
	}
	const viewBox = attributeValue(root, 'viewBox')?.trim().split(/[\s,]+/).map(Number);
	if (viewBox?.length === 4) {
		return positiveDimensions(viewBox[2], viewBox[3]);
	}
	return positiveDimensions(
		Number.parseFloat(attributeValue(root, 'width') ?? ''),
		Number.parseFloat(attributeValue(root, 'height') ?? ''),
	);
}

function pngDimensions(bytes: Uint8Array): { readonly width: number; readonly height: number } | undefined {
	if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return positiveDimensions(view.getUint32(16), view.getUint32(20));
}

function gifDimensions(bytes: Uint8Array): { readonly width: number; readonly height: number } | undefined {
	if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0, 3)) !== 'GIF') {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return positiveDimensions(view.getUint16(6, true), view.getUint16(8, true));
}

function jpegDimensions(bytes: Uint8Array): { readonly width: number; readonly height: number } | undefined {
	if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
		return undefined;
	}
	let offset = 2;
	while (offset + 8 < bytes.length) {
		if (bytes[offset] !== 0xff) {
			offset += 1;
			continue;
		}
		const marker = bytes[offset + 1];
		if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
			offset += 2;
			continue;
		}
		const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
		if (segmentLength < 2 || offset + segmentLength + 2 > bytes.length) {
			return undefined;
		}
		if (isJpegStartOfFrame(marker)) {
			return positiveDimensions(
				(bytes[offset + 7] << 8) | bytes[offset + 8],
				(bytes[offset + 5] << 8) | bytes[offset + 6],
			);
		}
		offset += segmentLength + 2;
	}
	return undefined;
}

function webpDimensions(bytes: Uint8Array): { readonly width: number; readonly height: number } | undefined {
	if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
		return undefined;
	}
	const chunk = ascii(bytes, 12, 4);
	if (chunk === 'VP8X') {
		return positiveDimensions(1 + uint24(bytes, 24), 1 + uint24(bytes, 27));
	}
	if (chunk === 'VP8L' && bytes[20] === 0x2f) {
		return positiveDimensions(
			1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
			1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
		);
	}
	if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		return positiveDimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
	}
	return undefined;
}

function bmpDimensions(bytes: Uint8Array): { readonly width: number; readonly height: number } | undefined {
	if (bytes.length < 26 || ascii(bytes, 0, 2) !== 'BM') {
		return undefined;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return positiveDimensions(Math.abs(view.getInt32(18, true)), Math.abs(view.getInt32(22, true)));
}

function isJpegStartOfFrame(marker: number): boolean {
	return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function positiveDimensions(width: number, height: number): { readonly width: number; readonly height: number } | undefined {
	return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 ? { width, height } : undefined;
}

function attributeValue(root: string, name: string): string | undefined {
	return root.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
	return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function uint24(bytes: Uint8Array, offset: number): number {
	return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function base64Bytes(value: string): Uint8Array {
	const binary = atob(value);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function isNoteConnection(edge: DiagramEdge): boolean {
	return edge.ontology_item_type === 'noteConnection';
}

export function elementCornerRadius(style: DiagramElementStyle | undefined, fallback: number): number {
	return style?.corner_radius ?? fallback;
}

export function plainPresentationText(value: string): string {
	if (!/<[a-z][\s\S]*>/iu.test(value)) {
		return value;
	}

	const documentValue = new DOMParser().parseFromString(value, 'text/html');
	return documentValue.body.textContent ?? value;
}
