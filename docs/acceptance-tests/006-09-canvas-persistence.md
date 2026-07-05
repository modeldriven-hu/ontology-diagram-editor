# Acceptance Tests: Canvas Persistence

## Save Flow

- Given a completed canvas edit, when the edit is valid, then the opened `.odiagram` text document is updated and a save is requested.
- Given the document edit is applied, when the save succeeds, then `Diagram document updated`, `Diagram save requested`, and `Diagram saved` are emitted in order.
- Given applying the document edit fails, when persistence handles the failure, then the document remains unchanged and `Diagram save failed` uses failure stage `document update`.
- Given saving to disk fails after the text document changes, when persistence handles the failure, then the text document remains dirty and the canvas stays consistent with the current text document state.

## Undo And Redo

- Given a drag produces many preview updates, when the drag completes, then only one logical document change is persisted.
- Given one gesture creates multiple elements, when undo runs, then all elements from that gesture are undone together where the Visual Studio Code document model allows it.
- Given undo or redo changes the `.odiagram` document, when the canvas observes the document state, then it rerenders from that state.
- Given undo or redo is initiated from canvas controls or shortcuts, when the action runs, then `Canvas undo requested` or `Canvas redo requested` is emitted.

## Editor-Only State

- Given selection, hover, active drag, property panel width, pan, or zoom changes, when persistence runs, then none of those values are written to the `.odiagram` file.
