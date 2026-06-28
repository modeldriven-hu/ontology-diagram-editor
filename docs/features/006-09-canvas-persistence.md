# Canvas Persistence

This specification defines how canvas edits are saved to the opened `.odiagram` file.

# Scope

This specification covers persistence of completed canvas edits, batching of user
gestures, undo and redo behavior, preservation of unknown fields, and save failure
behavior.

# Persistence

Every completed canvas edit shall update the opened `.odiagram` document and save the
updated file to disk. The persisted document shall remain valid according to the
`.odiagram` file format specification.

Canvas edits shall use the Visual Studio Code text document model when available so that
canvas edits remain visible in text editors and participate in undo and redo. After the
document edit is applied, the extension shall request a save for the `.odiagram` file.
Applying the document edit shall emit `Diagram document updated`; requesting the disk
save shall emit `Diagram save requested`; a successful disk save shall emit
`Diagram saved`.

Canvas edits that affect the same completed user gesture shall be persisted as one
logical document change. For example, dragging a node across the canvas can produce many
preview updates, but it shall produce one completed document change when the drag ends.

When one user gesture creates multiple diagram elements, the entire gesture shall be
persisted as one logical document change. For example, dropping an ontology relationship
can create a missing source node, a missing target node, and the edge between them, but
the result shall still undo and redo as one canvas edit where the Visual Studio Code
document model allows it.

The canvas shall preserve unknown fields in the `.odiagram` document whenever practical.

If applying the document edit fails, the canvas shall leave the document unchanged and
show the error to the user. The canvas shall emit `Diagram save failed` with failure
stage `document update`.

If saving the updated document to disk fails, the canvas shall keep the edited text
document dirty, clearly mark the save failure, and expose the save error to the user.
The user-visible canvas shall remain consistent with the current text document state,
not silently revert to an older saved file. The canvas shall emit `Diagram save failed`
with failure stage `disk save`.

# Undo And Redo

Canvas edits shall participate in the opened `.odiagram` document's undo and redo
history where the Visual Studio Code document model allows it.

Each completed canvas edit shall become one undoable operation where the Visual Studio
Code document model allows it. Intermediate preview states from an active gesture, such
as drag movement or edge preview updates, shall not be added to undo history as separate
document states.

Undoing a canvas edit shall restore the previous `.odiagram` document state and cause
the canvas to rerender from that restored document. Redoing the edit shall reapply the
later document state and rerender the canvas from that state.

Because canvas edits use autosave semantics in version 1, undoing or redoing a canvas
edit shall also request a save for the resulting `.odiagram` document state.

The canvas shall not maintain an independent persisted undo stack that can diverge from
the text document undo history. Editor-only state such as selection, hover, active drag,
panel height, pan, and zoom shall not be written to the `.odiagram` file.

Undo and redo of canvas edits shall emit `Canvas undo requested` or
`Canvas redo requested` when initiated from canvas controls or shortcuts. The resulting
document change shall follow the normal render, document update, and save event flow for changed
`.odiagram` content.
