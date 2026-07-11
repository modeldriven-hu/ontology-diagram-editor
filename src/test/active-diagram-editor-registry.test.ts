import * as assert from 'assert';

import { ActiveDiagramEditorRegistry } from '../diagram-editor/active-diagram-editor-registry';

suite('Active diagram editor registry', () => {
	test('activates the diagram when an existing custom editor tab becomes active', () => {
		const registry = new ActiveDiagramEditorRegistry<MutablePanel, string>();
		const firstPanel = { active: true };
		const secondPanel = { active: false };

		assert.strictEqual(registry.open(firstPanel, 'first.odiagram'), 'first.odiagram');
		assert.strictEqual(registry.open(secondPanel, 'second.odiagram'), undefined);

		firstPanel.active = false;
		secondPanel.active = true;
		assert.strictEqual(registry.activate(secondPanel), 'second.odiagram');
	});

	test('closing an inactive diagram leaves the active diagram selected', () => {
		const registry = new ActiveDiagramEditorRegistry<MutablePanel, string>();
		const activePanel = { active: true };
		const inactivePanel = { active: false };
		registry.open(activePanel, 'active.odiagram');
		registry.open(inactivePanel, 'inactive.odiagram');

		assert.deepStrictEqual(registry.close(inactivePanel), {
			closedDocument: 'inactive.odiagram',
		});
	});

	test('closing the active diagram selects another visible diagram', () => {
		const registry = new ActiveDiagramEditorRegistry<MutablePanel, string>();
		const firstPanel = { active: true };
		const secondPanel = { active: false };
		registry.open(firstPanel, 'first.odiagram');
		registry.open(secondPanel, 'second.odiagram');

		firstPanel.active = false;
		secondPanel.active = true;
		registry.activate(secondPanel);
		secondPanel.active = false;
		firstPanel.active = true;

		assert.deepStrictEqual(registry.close(secondPanel), {
			closedDocument: 'second.odiagram',
			replacementDocument: 'first.odiagram',
		});
	});
});

interface MutablePanel {
	active: boolean;
}
