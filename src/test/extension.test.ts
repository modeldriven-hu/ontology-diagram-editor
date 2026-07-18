import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('contributes Properties below the Model Tree', () => {
		const extension = vscode.extensions.getExtension('modeldriven-hu.ontology-diagram-editor');
		assert.ok(extension);
		const views = extension.packageJSON.contributes.views['ontology-diagram-editor'] as readonly {
			readonly id: string;
			readonly type?: string;
		}[];
		assert.deepStrictEqual(views.map((view) => view.id), [
			'ontology-diagram-editor.modelTree',
			'ontology-diagram-editor.properties',
		]);
		assert.strictEqual(views[1]?.type, 'webview');
	});
});
