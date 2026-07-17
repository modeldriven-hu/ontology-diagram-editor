import * as assert from 'assert';

import { constrainFixedToolbarOffset, constrainFixedToolbarPosition, dockedCanvasInsets, dockFixedToolbarPosition, snapFixedToolbarPosition } from '../ui/webview/engine/fixed-toolbar-controller';

suite('Fixed toolbar controller', () => {
	test('keeps a moved toolbar within its container bounds', () => {
		assert.deepStrictEqual(constrainFixedToolbarOffset(
			{ x: 500, y: -200 },
			{ width: 160, height: 36 },
			{ width: 300, height: 180 },
		), { x: 120, y: -4 });
	});

	test('preserves the default toolbar inset when it fits', () => {
		assert.deepStrictEqual(constrainFixedToolbarOffset(
			{ x: 0, y: 0 },
			{ width: 160, height: 36 },
			{ width: 300, height: 180 },
		), { x: 0, y: 0 });
	});

	test('keeps a docked toolbar attached to the bottom after a resize', () => {
		assert.deepStrictEqual(constrainFixedToolbarPosition(
			{ offset: { x: 50, y: 0 }, dock: 'bottom' },
			{ width: 160, height: 36 },
			{ width: 300, height: 180 },
		), { offset: { x: 50, y: 124 }, dock: 'bottom' });
	});

	test('snaps a toolbar dropped near the top or bottom edge', () => {
		const toolbar = { width: 160, height: 36 };
		const container = { width: 300, height: 180 };
		assert.deepStrictEqual(snapFixedToolbarPosition(
			{ offset: { x: 50, y: 12 } }, toolbar, container,
		), { offset: { x: 50, y: -4 }, dock: 'top' });
		assert.deepStrictEqual(snapFixedToolbarPosition(
			{ offset: { x: 50, y: 118 } }, toolbar, container,
		), { offset: { x: 50, y: 124 }, dock: 'bottom' });
	});

	test('detaches a docked toolbar when it is moved away from an edge', () => {
		assert.deepStrictEqual(snapFixedToolbarPosition(
			{ offset: { x: 50, y: 52 }, dock: 'bottom' },
			{ width: 160, height: 36 },
			{ width: 300, height: 180 },
		), { offset: { x: 50, y: 52 } });
	});

	test('pins a toolbar to the closest canvas edge on demand', () => {
		const toolbar = { width: 160, height: 36 };
		const container = { width: 300, height: 180 };
		assert.deepStrictEqual(dockFixedToolbarPosition(
			{ offset: { x: 50, y: 52 } }, toolbar, container,
		), { offset: { x: 50, y: -4 }, dock: 'top' });
		assert.deepStrictEqual(dockFixedToolbarPosition(
			{ offset: { x: 50, y: 80 } }, toolbar, container,
		), { offset: { x: 50, y: 124 }, dock: 'bottom' });
	});

	test('reserves canvas space for a docked toolbar', () => {
		const toolbar = { width: 160, height: 36 };
		assert.deepStrictEqual(dockedCanvasInsets({ offset: { x: 0, y: 0 }, dock: 'top' }, toolbar), { top: 36, bottom: 0 });
		assert.deepStrictEqual(dockedCanvasInsets({ offset: { x: 0, y: 0 }, dock: 'bottom' }, toolbar), { top: 0, bottom: 36 });
		assert.deepStrictEqual(dockedCanvasInsets({ offset: { x: 0, y: 0 } }, toolbar), { top: 0, bottom: 0 });
	});
});
