export function svgToPngBase64(svg: string, width: number, height: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener('load', () => {
			const canvas = document.createElement('canvas');
			const exportScale = Math.max(2, window.devicePixelRatio || 1);
			canvas.width = Math.ceil(width * exportScale);
			canvas.height = Math.ceil(height * exportScale);
			const context = canvas.getContext('2d');
			if (context === null) {
				reject(new Error('Could not create PNG export canvas.'));
				return;
			}

			context.scale(exportScale, exportScale);
			context.drawImage(image, 0, 0, width, height);
			resolve(canvas.toDataURL('image/png').split(',')[1] ?? '');
		});
		image.addEventListener('error', () => {
			reject(new Error('Could not render the diagram SVG as PNG.'));
		});
		image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	});
}


