import * as assert from 'assert';

import { CanvasViewportPersistence, type CanvasViewportStorage } from '../diagram-editor/canvas-viewport-persistence';

suite('Canvas viewport persistence', () => {
	test('restores the viewport for the same diagram URI', () => {
		const storage = new RecordingViewportStorage();
		storage.values.set('ontologyDiagramEditor.viewport.file:///workspace/diagram.odiagram', {
			panX: 120,
			panY: 240,
			zoom: 1.5,
		});

		const persistence = new CanvasViewportPersistence('file:///workspace/diagram.odiagram', storage);

		assert.deepStrictEqual(persistence.current(), {
			panX: 120,
			panY: 240,
			zoom: 1.5,
		});
	});

	test('saves the latest captured viewport for only its diagram URI', async () => {
		const storage = new RecordingViewportStorage();
		const persistence = new CanvasViewportPersistence('file:///workspace/diagram.odiagram', storage);
		persistence.capture({ panX: 10, panY: 20, zoom: 0.75 });
		persistence.capture({ panX: 30, panY: 40, zoom: 1.25 });

		await persistence.save();

		assert.deepStrictEqual(storage.values.get('ontologyDiagramEditor.viewport.file:///workspace/diagram.odiagram'), {
			panX: 30,
			panY: 40,
			zoom: 1.25,
		});
		assert.strictEqual(storage.updates.length, 1);
	});
});

class RecordingViewportStorage implements CanvasViewportStorage {
	public readonly values = new Map<string, unknown>();
	public readonly updates: string[] = [];

	public get<T>(key: string): T | undefined {
		return this.values.get(key) as T | undefined;
	}

	public async update(key: string, value: unknown): Promise<void> {
		this.updates.push(key);
		this.values.set(key, value);
	}
}
