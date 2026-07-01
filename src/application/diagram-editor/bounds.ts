import { Bounds } from '../../odiagram';
import type { NodeBoundsUpdate, NoteBoundsUpdate } from '../../shared/canvas-geometry';
import { roundCoordinate, roundPositiveSize } from './geometry';

export function toBounds(update: NodeBoundsUpdate | NoteBoundsUpdate): Bounds {
	return new Bounds(
		roundCoordinate(update.x),
		roundCoordinate(update.y),
		roundPositiveSize(update.width),
		roundPositiveSize(update.height),
	);
}

export function boundsEqual(left: Bounds, right: Bounds): boolean {
	return left.x === right.x
		&& left.y === right.y
		&& left.width === right.width
		&& left.height === right.height;
}
