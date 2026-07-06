import * as assert from 'assert';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { resolveTargetFolder } from '../diagram-editor/create-diagram-command';

suite('Create diagram command', () => {
	test('uses the selected folder as the target folder', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'create-diagram-command-'));
		try {
			const selectedFolder = path.join(directory, 'selected');
			await mkdir(selectedFolder);

			const target = await resolveTargetFolder(vscode.Uri.file(selectedFolder));

			assert.strictEqual(target?.fsPath, selectedFolder);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('uses the selected file parent as the target folder', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'create-diagram-command-'));
		try {
			const selectedFolder = path.join(directory, 'selected');
			const selectedFile = path.join(selectedFolder, 'existing.txt');
			await mkdir(selectedFolder);
			await writeFile(selectedFile, '');

			const target = await resolveTargetFolder(vscode.Uri.file(selectedFile));

			assert.strictEqual(target?.fsPath, selectedFolder);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('prompts for a target folder when no resource is provided', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'create-diagram-command-'));
		try {
			let didPrompt = false;

			const target = await resolveTargetFolder(undefined, async () => {
				didPrompt = true;
				return vscode.Uri.file(directory);
			});

			assert.strictEqual(didPrompt, true);
			assert.strictEqual(target?.fsPath, directory);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
