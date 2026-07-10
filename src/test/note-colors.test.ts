import * as assert from 'assert';

import { noteFoldBackground } from '../ui/webview/components/note-colors';
import type { WebviewTheme } from '../ui/webview/webview-theme';

suite('Note colors', () => {
	test('keeps the theme fold color for the default note background', () => {
		assert.strictEqual(noteFoldBackground('#CCFFCC', testTheme), '#B8E6B8');
	});

	test('derives a lighter fold color from custom note backgrounds', () => {
		assert.strictEqual(noteFoldBackground('#336699', testTheme), '#7497BA');
	});
});

const testTheme: WebviewTheme = {
	canvasBackground: '#FFFFFF',
	edgeColor: '#4A4A4A',
	edgeTextColor: '#000000',
	edgeWeight: 1,
	elementShadow: true,
	editorBackground: '#FFFFFF',
	editorForeground: '#000000',
	focusBorder: '#007FD4',
	fontFamily: 'Arial',
	fontSize: 13,
	iconBackground: '#FFFFFF',
	nodeBackground: '#FFFFCC',
	nodeBorder: '#333333',
	nodeCornerRadius: 0,
	nodeFontBold: false,
	nodeFontFamily: 'Arial',
	nodeFontItalic: false,
	nodeFontSize: 13,
	noteBackground: '#CCFFCC',
	noteBorder: '#669966',
	noteCornerRadius: 0,
	noteFoldBackground: '#B8E6B8',
	noteForeground: '#000000',
	shadowColor: 'rgb(0 0 0 / 16%)',
};
