import { assertFiniteNumber, assertPositiveNumber, type JsonObject } from './odiagram-core';

export class Point {
	public constructor(public readonly x: number, public readonly y: number) {
		assertFiniteNumber(x, 'Point x');
		assertFiniteNumber(y, 'Point y');
	}

	public toPersistenceObject(): JsonObject {
		return {
			x: this.x,
			y: this.y,
		};
	}
}

export class Bounds {
	public constructor(
		public readonly x: number,
		public readonly y: number,
		public readonly width: number,
		public readonly height: number,
	) {
		assertFiniteNumber(x, 'Bounds x');
		assertFiniteNumber(y, 'Bounds y');
		assertPositiveNumber(width, 'Bounds width');
		assertPositiveNumber(height, 'Bounds height');
	}

	public toPersistenceObject(): JsonObject {
		return {
			x: this.x,
			y: this.y,
			width: this.width,
			height: this.height,
		};
	}
}


