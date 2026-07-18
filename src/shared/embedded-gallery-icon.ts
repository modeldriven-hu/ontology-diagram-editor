export const defaultGalleryIconColor = '#2563EB';

const svgDataUriPrefix = 'data:image/svg+xml;base64,';
const galleryIconMarker = 'data-ontology-diagram-icon="true"';
const legacyGalleryIconColor = '#2563EB';

/** Creates a portable SVG data URI while retaining a replaceable monochrome icon color. */
export function createEmbeddedGalleryIcon(
	body: string,
	width: number,
	height: number,
	color = defaultGalleryIconColor,
): string {
	const normalizedColor = normalizeColor(color) ?? defaultGalleryIconColor;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ${galleryIconMarker} color="${normalizedColor}" fill="${normalizedColor}">${body}</svg>`;
	return `${svgDataUriPrefix}${encodeBase64(svg)}`;
}

/** Returns the color of an embedded gallery icon, excluding ordinary uploaded images and SVGs. */
export function embeddedGalleryIconColor(source: string | undefined): string | undefined {
	const decoded = decodeEmbeddedSvg(source);
	if (decoded === undefined) {
		return undefined;
	}
	const root = decoded.match(/^<svg\b[^>]*>/i)?.[0];
	if (root === undefined || (!root.includes(galleryIconMarker) && !isLegacyGalleryIcon(decoded, root))) {
		return undefined;
	}
	return normalizeColor(attributeValue(root, 'color') ?? attributeValue(root, 'fill'));
}

/** Recolors an embedded gallery icon and upgrades icons created before color metadata was added. */
export function recolorEmbeddedGalleryIcon(source: string, color: string): string | undefined {
	const currentColor = embeddedGalleryIconColor(source);
	const nextColor = normalizeColor(color);
	const decoded = decodeEmbeddedSvg(source);
	if (currentColor === undefined || nextColor === undefined || decoded === undefined) {
		return undefined;
	}

	const root = decoded.match(/^<svg\b[^>]*>/i)?.[0];
	if (root === undefined) {
		return undefined;
	}
	let nextSvg = decoded;
	if (!root.includes(galleryIconMarker)) {
		nextSvg = nextSvg.replaceAll(currentColor.toLowerCase(), nextColor).replaceAll(currentColor.toUpperCase(), nextColor);
	}
	const nextRoot = withAttribute(withAttribute(withMarker(root), 'color', nextColor), 'fill', nextColor);
	nextSvg = nextSvg.replace(nextSvg.match(/^<svg\b[^>]*>/i)?.[0] ?? root, nextRoot);
	return `${svgDataUriPrefix}${encodeBase64(nextSvg)}`;
}

function decodeEmbeddedSvg(source: string | undefined): string | undefined {
	if (source === undefined || !source.startsWith(svgDataUriPrefix)) {
		return undefined;
	}
	try {
		return decodeBase64(source.slice(svgDataUriPrefix.length));
	} catch {
		return undefined;
	}
}

function isLegacyGalleryIcon(svg: string, root: string): boolean {
	const color = normalizeColor(attributeValue(root, 'color'));
	const fill = normalizeColor(attributeValue(root, 'fill'));
	return color === legacyGalleryIconColor && fill === legacyGalleryIconColor
		&& svg.toLocaleLowerCase().includes(legacyGalleryIconColor.toLocaleLowerCase());
}

function attributeValue(root: string, name: string): string | undefined {
	return root.match(new RegExp(`\\s${name}="([^"]+)"`, 'i'))?.[1];
}

function withAttribute(root: string, name: string, value: string): string {
	const expression = new RegExp(`(\\s${name}=")[^"]*(")`, 'i');
	return expression.test(root)
		? root.replace(expression, `$1${value}$2`)
		: root.replace(/>$/, ` ${name}="${value}">`);
}

function withMarker(root: string): string {
	return root.includes(galleryIconMarker) ? root : root.replace(/>$/, ` ${galleryIconMarker}>`);
}

function normalizeColor(value: string | undefined): string | undefined {
	if (value === undefined || !/^#[0-9a-f]{6}$/i.test(value.trim())) {
		return undefined;
	}
	return value.trim().toUpperCase();
}

function encodeBase64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function decodeBase64(value: string): string {
	const binary = atob(value);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}
