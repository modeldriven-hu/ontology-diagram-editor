import * as path from 'path';
import * as vscode from 'vscode';

import { parseOntologyDiagramTextDocument } from '../documents/odiagram';
import { diagramDependencyPaths, type DiagramDependency, type DiagramDependencyKind } from './diagram-dependency-paths';

export interface DiagramDependencyChangedEvent {
	readonly diagramUri: vscode.Uri;
	readonly dependencyUri: vscode.Uri;
	readonly kind: DiagramDependencyKind;
}

export class DiagramDependencyWatcher implements vscode.Disposable {
	private readonly watchers = new Map<string, vscode.FileSystemWatcher>();

	public constructor(
		private readonly document: vscode.TextDocument,
		private readonly onDidChangeDependency: (event: DiagramDependencyChangedEvent) => void,
	) {
		this.refresh();
	}

	public refresh(): void {
		let dependencies: readonly DiagramDependency[] = [];
		try {
			dependencies = diagramDependencyPaths(
				this.document.uri.fsPath,
				parseOntologyDiagramTextDocument(this.document),
			);
		} catch {
			// An invalid diagram has no reliable dependency set. Document validation reports the error.
		}

		const nextKeys = new Set(dependencies.map(dependencyKey));
		for (const [key, watcher] of this.watchers) {
			if (!nextKeys.has(key)) {
				watcher.dispose();
				this.watchers.delete(key);
			}
		}

		for (const dependency of dependencies) {
			const key = dependencyKey(dependency);
			if (!this.watchers.has(key)) {
				this.watchers.set(key, this.createWatcher(dependency));
			}
		}
	}

	public dispose(): void {
		for (const watcher of this.watchers.values()) {
			watcher.dispose();
		}
		this.watchers.clear();
	}

	private createWatcher(dependency: DiagramDependency): vscode.FileSystemWatcher {
		const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(
			vscode.Uri.file(path.dirname(dependency.absolutePath)),
			path.basename(dependency.absolutePath),
		));
		const notify = (dependencyUri: vscode.Uri): void => {
			this.onDidChangeDependency({
				diagramUri: this.document.uri,
				dependencyUri,
				kind: dependency.kind,
			});
		};
		watcher.onDidChange(notify);
		watcher.onDidCreate(notify);
		watcher.onDidDelete(notify);

		return watcher;
	}
}

function dependencyKey(dependency: DiagramDependency): string {
	return `${dependency.kind}:${path.normalize(dependency.absolutePath)}`;
}
