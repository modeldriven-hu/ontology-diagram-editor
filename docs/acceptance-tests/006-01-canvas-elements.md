# Acceptance Tests: Canvas Elements

## Display And Selection

- Given a `.odiagram` file is opened, when the canvas renders it, then each rendered item has a mapping to its persisted element identifier.
- Given degraded rendering warnings exist, when the canvas renders valid independent elements, then the warnings are exposed to the user.
- Given the user clicks a diagram element, when selection changes, then the element shows a visible selection outline and `Canvas selection changed` is emitted.
- Given the user drags the left mouse button from a blank canvas area around diagram elements, when the selection rectangle encloses them, then all enclosed eligible elements are selected.
- Given the user selects multiple bounded elements, when one selected element or the selection outline is dragged, then multi-selection mouse movement is ignored and the elements remain in place.
- Given multiple bounded elements are selected, when the user presses an arrow key, then all selected bounded elements move by the same keyboard nudge offset.
- Given multiple bounded elements are selected with an edge between selected endpoints, when the selection is moved with an arrow key, then the edge route points and label move by the same offset instead of being rerouted.
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
