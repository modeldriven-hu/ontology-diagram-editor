export interface DiagramExportSaveRequest {
	readonly format: 'svg' | 'png';
	readonly defaultDirectory: string;
	readonly defaultFileName: string;
	readonly content: string;
	readonly encoding: 'utf8' | 'base64';
}

export interface DiagramExportSaveTargetRequest {
	readonly format: 'svg' | 'png';
	readonly extension: string;
	readonly formatLabel: string;
	readonly defaultDirectory: string;
	readonly defaultFileName: string;
	readonly saveLabel: string;
	readonly title: string;
}

export interface DiagramExportSavePort {
	chooseTarget(request: DiagramExportSaveTargetRequest): Promise<string | undefined>;
	writeFile(targetPath: string, content: Uint8Array): Promise<void>;
}

export interface DiagramExportSaveResult {
	readonly notification?: string;
}

export class SaveDiagramExportUseCase {
	public constructor(private readonly savePort: DiagramExportSavePort) {}

	public async execute(request: DiagramExportSaveRequest): Promise<DiagramExportSaveResult> {
		const extension = request.format === 'svg' ? 'svg' : 'png';
		const formatLabel = request.format === 'svg' ? 'SVG image' : 'PNG image';
		const targetPath = await this.savePort.chooseTarget({
			format: request.format,
			extension,
			formatLabel,
			defaultDirectory: request.defaultDirectory,
			defaultFileName: request.defaultFileName,
			saveLabel: `Save ${request.format.toUpperCase()}`,
			title: `Save diagram as ${request.format.toUpperCase()}`,
		});
		if (targetPath === undefined) {
			return {};
		}

		await this.savePort.writeFile(targetPath, exportBytes(request.content, request.encoding));

		return {
			notification: `Saved diagram export to ${targetPath}.`,
		};
	}
}

function exportBytes(content: string, encoding: 'utf8' | 'base64'): Uint8Array {
	if (encoding === 'base64') {
		return Buffer.from(content, 'base64');
	}

	return new TextEncoder().encode(content);
}
