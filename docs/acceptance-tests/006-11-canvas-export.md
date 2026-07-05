# Acceptance Tests: Canvas Export

## Export Actions

- Given a non-empty diagram is open, when the user chooses Export SVG, then the extension opens a save dialog for an SVG image using a default name derived from the `.odiagram` file.
- Given a non-empty diagram is open, when the user chooses Export PNG, then the extension opens a save dialog for a PNG image using a default name derived from the `.odiagram` file.
- Given the diagram has no exportable content, when the user chooses an export action, then no export file is written and the user sees a concise message.
- Given the save dialog is cancelled, when an export action runs, then no export file is written.

## Export Content

- Given nodes, edges, images, labels, and export-included notes are present, when an export is created, then those elements appear in deterministic draw order.
- Given a note has `export: false`, when an export is created, then that note is omitted from the exported image but remains visible in the interactive canvas.
- Given a node has `show_data_properties: true`, when an export is created, then the exported node includes its visible data-property attribute section.
- Given the canvas is in dark mode, when an export is created, then the export uses the dark-mode resolved styles.

## File Output

- Given an SVG export target is confirmed, when the file is written, then UTF-8 SVG content is saved to the chosen path.
- Given a PNG export target is confirmed, when the file is written, then decoded PNG bytes are saved to the chosen path.
- Given an export is saved successfully, when the operation completes, then the user sees a confirmation containing the target path.
- Given an export is saved, when the opened `.odiagram` document is inspected, then diagram content and undo history are unchanged.
