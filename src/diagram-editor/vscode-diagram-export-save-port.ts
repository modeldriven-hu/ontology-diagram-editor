import * as vscode from 'vscode';
import type { DiagramExportSavePort } from './use-cases';

export class VsCodeDiagramExportSavePort implements DiagramExportSavePort {
	public async chooseTarget(request: Parameters<DiagramExportSavePort['chooseTarget']>[0]): Promise<string | undefined> {
		const targetUri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.joinPath(
				vscode.Uri.file(request.defaultDirectory),
				request.defaultFileName,
			),
			filters: {
				[request.formatLabel]: [request.extension],
			},
			saveLabel: request.saveLabel,
			title: request.title,
		});

		return targetUri?.fsPath;
	}

	public async writeFile(targetPath: string, content: Uint8Array): Promise<void> {
		await vscode.workspace.fs.writeFile(vscode.Uri.file(targetPath), content);
	}
}


