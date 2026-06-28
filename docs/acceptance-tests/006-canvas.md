# Acceptance Tests: Canvas

## MVP Editing Loop

- Given a valid `.odiagram` file, when it is opened in the canvas view, then all version 1 element types render.
- Given the diagram has no renderable elements, when the canvas opens, then an empty-canvas state is shown and accepts valid ontology drops.
- Given a completed canvas edit, when persistence runs, then the opened `.odiagram` document is updated and remains valid.
- Given a rejected canvas action, when the action fails validation, then the document remains unchanged and the user sees a concise problem message.

## Viewport

- Given the user pans or zooms, when the viewport changes, then persisted diagram coordinates are unchanged.
- Given the user chooses fit, reset, or reveal selected element, when the command runs, then the viewport updates and emits `Canvas viewport changed`.
- Given the same diagram rerenders after document, ontology, theme, or image updates, when rerendering completes, then the user's viewport state is preserved.

## Commands And Errors

- Given the create-new-diagram command runs, when the user chooses a target path, then a valid empty `.odiagram` file is created and opened in the canvas view.
- Given a command cannot run in the current state, when the user invokes it, then it is disabled or fails without changing the `.odiagram` document.
- Given a fatal rendering error occurs, when the canvas displays the error, then the file path and error message remain visible.
