import { BorderStyle, CommonStyle, EdgeStyle, FontStyle, LabelStyle } from '../odiagram';
import { OntologyDiagramTheme } from './otheme-document';

export const defaultOntologyDiagramTheme = new OntologyDiagramTheme(
	new CommonStyle(
		'#FFFFFF',
		'#1F2328',
		new FontStyle('Arial', false, false, 12),
		new BorderStyle('solid', 1, '#8C959F'),
	),
	new EdgeStyle(
		'#57606A',
		'solid',
		1.25,
		'#1F2328',
		new FontStyle('Arial', false, false, 10),
	),
	new CommonStyle(
		'#FFF8C5',
		'#24292F',
		new FontStyle('Arial', false, false, 11),
		new BorderStyle('dashed', 1, '#D4A72C'),
	),
	new LabelStyle(
		'#24292F',
		new FontStyle('Arial', false, false, 12),
	),
);
