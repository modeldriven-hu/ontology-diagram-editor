import type { WebviewTheme } from '../webview-theme';

export function noteFoldBackground(noteBackground: string, theme: WebviewTheme): string {
	if (noteBackground.trim() === theme.noteBackground.trim()) {
		return theme.noteFoldBackground;
	}

	const rgba = parseRgbColor(noteBackground);
	if (rgba === null) {
		return theme.noteFoldBackground;
	}

	return rgbaToHex({
		r: lightenChannel(rgba.r),
		g: lightenChannel(rgba.g),
		b: lightenChannel(rgba.b),
		a: rgba.a,
	});
}

function lightenChannel(channel: number): number {
	return Math.round(channel + ((255 - channel) * 0.32));
}

interface RgbaColor {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
}

function parseRgbColor(value: string): RgbaColor | null {
	const trimmed = value.trim();
	const hex = parseHexColor(trimmed);
	if (hex !== null) {
		return hex;
	}

	const rgbMatch = /^rgba?\(\s*([+-]?(?:\d*\.)?\d+)\s*(?:,|\s)\s*([+-]?(?:\d*\.)?\d+)\s*(?:,|\s)\s*([+-]?(?:\d*\.)?\d+)(?:\s*[,/]\s*([+-]?(?:\d*\.)?\d+))?\s*\)$/iu.exec(trimmed);
	if (rgbMatch === null) {
		return null;
	}

	return {
		r: clampColorChannel(Number(rgbMatch[1])),
		g: clampColorChannel(Number(rgbMatch[2])),
		b: clampColorChannel(Number(rgbMatch[3])),
		a: clampAlpha(rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4])),
	};
}

function parseHexColor(value: string): RgbaColor | null {
	const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu.exec(value);
	if (hexMatch === null) {
		return null;
	}

	const hex = hexMatch[1];
	if (hex.length === 3 || hex.length === 4) {
		return {
			r: Number.parseInt(`${hex[0]}${hex[0]}`, 16),
			g: Number.parseInt(`${hex[1]}${hex[1]}`, 16),
			b: Number.parseInt(`${hex[2]}${hex[2]}`, 16),
			a: hex.length === 4 ? Number.parseInt(`${hex[3]}${hex[3]}`, 16) / 255 : 1,
		};
	}

	return {
		r: Number.parseInt(hex.slice(0, 2), 16),
		g: Number.parseInt(hex.slice(2, 4), 16),
		b: Number.parseInt(hex.slice(4, 6), 16),
		a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
	};
}

function rgbaToHex(color: RgbaColor): string {
	const alpha = color.a < 1 ? hexByte(Math.round(color.a * 255)) : '';

	return `#${hexByte(color.r)}${hexByte(color.g)}${hexByte(color.b)}${alpha}`;
}

function hexByte(value: number): string {
	return clampColorChannel(value).toString(16).toUpperCase().padStart(2, '0');
}

function clampColorChannel(value: number): number {
	return Math.min(255, Math.max(0, Math.round(value)));
}

function clampAlpha(value: number): number {
	return Math.min(1, Math.max(0, value));
}
