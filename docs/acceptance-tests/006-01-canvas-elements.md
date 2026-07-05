# Acceptance Tests: Canvas Elements

## Display And Selection

- Given a `.odiagram` file is opened, when the canvas renders it, then each rendered item has a mapping to its persisted element identifier.
- Given degraded rendering warnings exist, when the canvas renders valid independent elements, then the warnings are exposed to the user.
- Given the user clicks a diagram element, when selection changes, then the element shows a visible selection outline and `Canvas selection changed` is emitted.
- Given the same diagram rerenders and the selected element still exists, when rendering completes, then the canvas restores that selection.

## Text Editing

- Given a note or label is selected, when the user double-clicks it or presses `Enter`, then on-canvas text editing starts.
- Given on-canvas text editing is active, when the user types or presses editing keys, then text changes do not trigger canvas shortcuts.
- Given a label text edit is active, when the user presses `Enter`, then the edit commits as one logical document change.
- Given a note text edit is active, when the user presses `Enter`, then a newline is inserted.
- Given a text edit is active, when the user presses `Escape`, then the in-progress edit is canceled and the last committed text is restored.

## Delete

- Given an element is selected, when the user presses `Delete`, then the selected element is removed from its `.odiagram` section.
- Given a node is deleted, when persistence completes, then all edges connected to that node are also removed.
- Given text editing is active, when the user presses `Delete` or `Backspace`, then text is edited rather than deleting the selected diagram element.
