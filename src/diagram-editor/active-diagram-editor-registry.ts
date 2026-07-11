export interface DiagramEditorPanelState {
	readonly active: boolean;
}

export interface ClosedDiagramEditor<TDocument> {
	readonly closedDocument: TDocument;
	readonly replacementDocument?: TDocument;
}

export class ActiveDiagramEditorRegistry<TPanel extends DiagramEditorPanelState, TDocument> {
	private readonly documents = new Map<TPanel, TDocument>();
	private activePanel?: TPanel;

	public open(panel: TPanel, document: TDocument): TDocument | undefined {
		this.documents.set(panel, document);
		return panel.active ? this.activate(panel) : undefined;
	}

	public activate(panel: TPanel): TDocument | undefined {
		const document = this.documents.get(panel);
		if (document === undefined || !panel.active) {
			return undefined;
		}

		this.activePanel = panel;
		return document;
	}

	public close(panel: TPanel): ClosedDiagramEditor<TDocument> | undefined {
		const closedDocument = this.documents.get(panel);
		if (closedDocument === undefined) {
			return undefined;
		}

		const wasActive = this.activePanel === panel;
		this.documents.delete(panel);
		if (!wasActive) {
			return { closedDocument };
		}

		const replacementPanel = [...this.documents.keys()].find((candidate) => candidate.active);
		this.activePanel = replacementPanel;
		return {
			closedDocument,
			replacementDocument: replacementPanel === undefined
				? undefined
				: this.documents.get(replacementPanel),
		};
	}
}
