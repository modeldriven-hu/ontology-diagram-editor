import type { WebviewThemeMode } from '../webview-theme';

export type CanvasColorRole = 'surface' | 'accent' | 'foreground';

export interface CanvasColorSwatch {
	readonly label: string;
	readonly value: string;
}

type CanvasColorPaletteSet = Readonly<Record<CanvasColorRole, readonly CanvasColorSwatch[]>>;

const colorLabels = [
	'Slate', 'Blue', 'Sky', 'Cyan', 'Teal', 'Emerald',
	'Lime', 'Amber', 'Orange', 'Rose', 'Fuchsia', 'Violet',
] as const;

export const lightCanvasColorPalettes: CanvasColorPaletteSet = {
	surface: palette([
		'#CBD5E1', '#BFDBFE', '#BAE6FD', '#A5F3FC', '#99F6E4', '#A7F3D0',
		'#D9F99D', '#FDE68A', '#FED7AA', '#FECDD3', '#F5D0FE', '#DDD6FE',
	]),
	accent: palette([
		'#64748B', '#2563EB', '#0284C7', '#0891B2', '#0F766E', '#15803D',
		'#4D7C0F', '#B45309', '#C2410C', '#BE123C', '#A21CAF', '#6D28D9',
	]),
	foreground: palette([
		'#334155', '#1D4ED8', '#0369A1', '#0E7490', '#115E59', '#166534',
		'#3F6212', '#92400E', '#9A3412', '#9F1239', '#86198F', '#5B21B6',
	]),
};

export const darkCanvasColorPalettes: CanvasColorPaletteSet = {
	surface: palette([
		'#1E293B', '#172554', '#082F49', '#083344', '#042F2E', '#052E16',
		'#1A2E05', '#422006', '#431407', '#4C0519', '#4A044E', '#2E1065',
	]),
	accent: palette([
		'#94A3B8', '#60A5FA', '#38BDF8', '#22D3EE', '#2DD4BF', '#4ADE80',
		'#A3E635', '#FBBF24', '#FB923C', '#FB7185', '#E879F9', '#A78BFA',
	]),
	foreground: palette([
		'#CBD5E1', '#93C5FD', '#7DD3FC', '#67E8F9', '#5EEAD4', '#86EFAC',
		'#BEF264', '#FDE68A', '#FDBA74', '#FDA4AF', '#F0ABFC', '#C4B5FD',
	]),
};

export function canvasColorPalette(
	mode: WebviewThemeMode,
	role: CanvasColorRole = 'accent',
): readonly CanvasColorSwatch[] {
	return (mode === 'dark' ? darkCanvasColorPalettes : lightCanvasColorPalettes)[role];
}

function palette(values: readonly string[]): readonly CanvasColorSwatch[] {
	return values.map((value, index) => ({
		label: colorLabels[index] ?? `Color ${index + 1}`,
		value,
	}));
}
