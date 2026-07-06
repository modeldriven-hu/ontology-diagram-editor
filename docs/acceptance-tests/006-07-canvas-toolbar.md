# Acceptance Tests: Canvas Toolbar

## Canvas Toolbar

- Given the canvas view is open, when the user pans, scrolls, or zooms, then the canvas toolbar remains visible over the viewport.
- Given the user chooses Add Note, Add Label, or Add Image, when the action completes, then the corresponding element is created through the canvas workflow.
- Given the user chooses Undo or Redo from the toolbar, when the action runs, then the opened `.odiagram` document undo or redo operation is requested.
- Given the user chooses Export SVG or Export PNG, when the diagram has exportable content, then the export workflow defined in `006-11-canvas-export.md` starts.
- Given the user chooses Arrange Diagram with ontology nodes present, when persistence completes, then nodes are arranged and connected edges are rerouted as one logical edit.
- Given the user chooses Fit, Reset, Zoom In, or Zoom Out, when the viewport changes, then persisted diagram coordinates are unchanged.
- Given an ontology-backed node or edge is selected, when the user chooses Select corresponding model-tree item, then the matching model-tree item is revealed when one exists.
- Given no ontology-backed canvas element is selected, when the user chooses Select corresponding model-tree item, then the user sees a concise problem message.

## Theme Mode

- Given the canvas is in light mode, when the user toggles theme mode, then the canvas rerenders in dark mode and persists `metadata.theme_mode: dark`.
- Given the canvas is in dark mode, when the user toggles theme mode, then the canvas rerenders in light mode and persists `metadata.theme_mode: light`.
- Given the diagram references an `.otheme` file, when theme mode is toggled, then the theme file is not modified.

## Local Element Toolbar

- Given a node is selected, when the local toolbar appears, then Resize to minimum, Create note from ontology comment, and Show related elements are available.
- Given a selected node has no ontology comment, when the local toolbar appears, then Create note from ontology comment is disabled or reports a concise problem.
- Given a node is selected, when the user chooses Show related elements and selects a depth, then related object property, data property, and subclass relationship endpoints up to that depth are added without duplicating existing nodes or edges.
- Given a note is selected, when the local toolbar appears, then Resize to compact size and Connect Note are available.
- Given an image or label is selected, when the local toolbar appears, then Resize to minimum is available.
- Given an edge is selected, when the local toolbar appears, then Optimize edge path and Remove edge are available.
- Given note or label text editing is active, when the user edits text, then the local toolbar is hidden.

## Style Editing Boundary

- Given a node, edge, note, or label is selected, when the user edits style fields, then those edits are made through the property panel and not the canvas toolbar.
- Given a style edit is persisted, when the active theme file is inspected, then it is unchanged.
