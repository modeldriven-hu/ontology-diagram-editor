import { OntologyDiagramValidationError, assertNonNegativeNumber, assertPositiveNumber, omitUndefined, type BorderType, type EdgeLineStyle, type JsonObject } from './odiagram-core';

export class FontStyle {
	public constructor(
		public readonly family?: string,
		public readonly bold?: boolean,
		public readonly italic?: boolean,
		public readonly size?: number,
		public readonly extra: JsonObject = {},
	) {
		if (family !== undefined && family.trim().length === 0) {
			throw new OntologyDiagramValidationError('Font family must be a non-empty string.');
		}
		if (size !== undefined) {
			assertPositiveNumber(size, 'Font size');
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			family: this.family,
			bold: this.bold,
			italic: this.italic,
			size: this.size,
		});
	}
}

export class BorderStyle {
	public constructor(
		public readonly type?: BorderType,
		public readonly weight?: number,
		public readonly color?: string,
		public readonly extra: JsonObject = {},
	) {
		if (weight !== undefined) {
			assertNonNegativeNumber(weight, 'Border weight');
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			type: this.type,
			weight: this.weight,
			color: this.color,
		});
	}
}

export class CommonStyle {
	public constructor(
		public readonly bgColor?: string,
		public readonly textColor?: string,
		public readonly font?: FontStyle,
		public readonly border?: BorderStyle,
		public readonly extra: JsonObject = {},
		public readonly cornerRadius?: number,
		public readonly shadow?: boolean,
		public readonly imageFit?: 'contain' | 'cover' | 'match_width' | 'match_height',
	) {
		if (cornerRadius !== undefined) {
			assertNonNegativeNumber(cornerRadius, 'Corner radius');
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			bg_color: this.bgColor,
			text_color: this.textColor,
			font: this.font?.toPersistenceObject(),
			border: this.border?.toPersistenceObject(),
			corner_radius: this.cornerRadius,
			shadow: this.shadow,
			image_fit: this.imageFit,
		});
	}
}

export class LabelStyle {
	public constructor(
		public readonly textColor?: string,
		public readonly font?: FontStyle,
		public readonly extra: JsonObject = {},
	) {
		const unsupportedFields = Object.keys(extra).filter((field) => field !== 'text_color' && field !== 'font');
		if (unsupportedFields.length > 0) {
			throw new OntologyDiagramValidationError(`Label style contains unsupported fields: ${unsupportedFields.join(', ')}.`);
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			text_color: this.textColor,
			font: this.font?.toPersistenceObject(),
		});
	}
}

export class EdgeStyle {
	public constructor(
		public readonly color?: string,
		public readonly lineStyle?: EdgeLineStyle,
		public readonly weight?: number,
		public readonly textColor?: string,
		public readonly font?: FontStyle,
		public readonly extra: JsonObject = {},
	) {
		if (weight !== undefined) {
			assertNonNegativeNumber(weight, 'Edge weight');
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			color: this.color,
			line_style: this.lineStyle,
			weight: this.weight,
			text_color: this.textColor,
			font: this.font?.toPersistenceObject(),
		});
	}
}

