# Acceptance Tests: Canvas

## MVP Editing Loop

- Given a valid `.odiagram` file, when it is opened in the canvas view, then all version 1 element types render.
- Given the diagram has no renderable elements, when the canvas opens, then an empty-canvas state is shown and accepts valid ontology drops.
- Given a completed canvas edit, when persistence runs, then the opened `.odiagram` document is updated and remains valid.
- Given a rejected canvas action, when the action fails validation, then the document remains unchanged and the user sees a concise problem message.
- Given the user switches theme mode, when persistence completes, then `metadata.theme_mode` stores the selected light or dark mode.
- Given a non-empty diagram is open, when the user exports SVG or PNG, then an export file can be saved without modifying the `.odiagram` document.

## Viewport

- Given the user pans or zooms, when the viewport changes, then persisted diagram coordinates are unchanged.
- Given the user chooses fit or reset, when the action runs, then the viewport updates and emits `Canvas viewport changed`.
- Given the same diagram rerenders after document, ontology, theme, or image updates, when rerendering completes, then the user's viewport state is preserved.

## Actions And Errors

- Given the create-new-diagram command runs without an Explorer resource, when the user chooses a target folder and enters a file name, then a valid empty `.odiagram` file is created in that folder and opened in the canvas view.
- Given the create-new-diagram command runs from a selected Explorer folder, when the user enters a file name, then the new `.odiagram` file is created in that selected folder.
- Given an action cannot run in the current state, when the user invokes it, then it is disabled or fails without changing the `.odiagram` document.
- Given a fatal rendering error occurs, when the canvas displays the error, then the file path and error message remain visible.
