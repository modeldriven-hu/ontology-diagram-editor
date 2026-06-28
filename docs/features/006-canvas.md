# Canvas

The canvas is the main diagram editing surface in the Visual Studio Code webview. It
displays the rendered `.odiagram` content and allows users to create, position, connect,
customize, and remove diagram elements.

# Scope

This specification defines the shared canvas concepts and links to smaller canvas
feature specifications.

Rendering rules are defined by the rendering specification. Persisted fields are defined
by the `.odiagram` file format specification. Model tree item drag and drop events are
defined by the model tree and canvas events specifications.

# Related Specifications

Canvas behavior is split into these feature specifications:

| Specification | Scope |
|---------------|-------|
| `006-01-canvas-elements.md` | Shared element behavior: displaying the diagram, selecting elements, deletion, keyboard behavior, and general canvas errors. |
| `006-02-canvas-nodes.md` | Creating, moving, and resizing ontology-backed nodes. |
| `006-03-canvas-edges.md` | Creating ontology-backed edges, edge previews, automatic endpoint updates, edge label movement, and ontology-to-UML rendering mapping. |
| `006-04-canvas-notes.md` | Adding, editing, moving, and resizing notes. |
| `006-05-canvas-labels.md` | Adding, editing, and moving standalone labels. |
| `006-06-canvas-images.md` | Adding, moving, resizing, and sourcing standalone images. |
| `006-07-canvas-toolbar.md` | Floating toolbar behavior and element-level style customization. |
| `006-08-canvas-events.md` | Canvas event architecture and event payloads. |
| `006-09-canvas-persistence.md` | Saving canvas edits to `.odiagram`, batching gesture changes, preserving unknown fields, and persistence failures. |
| `006-10-canvas-property-panel.md` | Bottom property panel behavior for inspecting and editing selected element properties. |

# Concepts

The canvas operates on persisted `.odiagram` elements:

| Canvas element | Persisted section | Description |
|----------------|-------------------|-------------|
| Node | `nodes` | Ontology-backed box. |
| Edge | `edges` | Ontology-backed connection between two nodes. |
| Note | `notes` | Standalone free-form annotation. |
| Image | `images` | Standalone image placed on the canvas. |
| Label | `labels` | Standalone text placed on the canvas. |

The canvas shall not persist editor-only state such as hover state, drag previews,
selection handles, temporary connection previews, or floating toolbar visibility.

# Shared Requirements

Every completed canvas edit shall update the opened `.odiagram` document. The persisted
document shall remain valid according to the `.odiagram` file format specification.

The canvas shall be event based. User gestures, model tree drops, file updates, and
persistence operations shall produce events that other parts of the extension can
subscribe to.

# Minimum Viable Product Scope

The minimum viable product shall provide a complete single-user diagram editing
experience for ontology-backed diagrams in the Visual Studio Code webview.

The minimum viable product shall support:

- Opening a valid `.odiagram` file in the Visual Studio Code webview.
- Rendering all persisted version 1 element types from the opened file.
- Showing an empty-canvas state when the diagram has no renderable elements.
- Creating nodes by dragging classes, individuals, and datatypes from the model tree.
- Creating connection-capable ontology edges by materializing the resolved source and
  target nodes when either endpoint is missing from the canvas.
- Adding notes, standalone labels, and standalone images through canvas commands.
- Selecting, moving, resizing where supported, and deleting canvas elements.
- Editing note and label text.
- Moving edge label positions and keeping edge endpoints connected when nodes move or
  resize.
- Customizing element-level style through the floating toolbar.
- Inspecting selected elements and editing supported non-style fields through the
  property panel.
- Persisting completed edits back to the opened `.odiagram` document.
- Grouping each completed user gesture into one undoable and redoable edit where the
  Visual Studio Code document model allows it.
- Providing viewport controls for panning, zooming, fitting the diagram to view, and
  resetting the viewport.
- Showing validation and persistence errors in a user-visible way.

The minimum viable product does not include automatic layout, multi-user editing,
multi-selection editing, grouping, layer management, freehand drawing, direct ontology
source editing, or theme file editing from canvas controls.

# Viewport Controls

The canvas shall support panning and zooming the diagram view without changing persisted
diagram coordinates.

The user shall be able to:

- Pan the viewport by dragging the canvas background or using platform-appropriate
  scroll gestures.
- Zoom in and out using platform-appropriate pointer or keyboard gestures.
- Fit all rendered diagram content into the visible viewport.
- Reset the viewport to an implementation-defined default zoom and pan.

Viewport state, including pan position and zoom level, is editor-only state and shall
not be persisted to the `.odiagram` file.

When rerendering the same diagram after document, ontology, theme, or image updates, the
canvas shall preserve the user's viewport state.

When the selected element is outside the visible viewport because of a selection change
from another UI surface, the canvas shall provide a way to reveal the selected element.

# Canvas Commands

The canvas shall expose common actions through Visual Studio Code commands so they can
be reached from the command palette and keybindings.

Version 1 shall define commands for:

- Create new diagram.
- Add note.
- Add standalone label.
- Add standalone image.
- Delete selected element.
- Undo canvas edit.
- Redo canvas edit.
- Zoom in.
- Zoom out.
- Fit diagram to view.
- Reset viewport.
- Reveal selected element.
- Toggle property panel.

The create new diagram command shall ask the user for a target `.odiagram` path and
create a valid empty diagram document using the `.odiagram` file format specification.
After creation, the extension shall open the new file in the canvas view.

Commands that cannot currently run shall be disabled or shall fail without changing the
`.odiagram` document. Examples include deleting when no element is selected, revealing a
missing selected element, or adding an image when no `.odiagram` file is open.

# Validation And Error Presentation

The canvas shall expose validation and persistence problems in a user-visible way.

The canvas shall distinguish:

- Fatal rendering errors that prevent the diagram from being shown.
- Degraded rendering warnings where valid independent elements can still be shown.
- Validation errors caused by attempted user actions.
- Persistence errors caused by saving the `.odiagram` document.

Fatal rendering errors shall replace the diagram surface with an error state that keeps
the file path and error message visible to the user.

Degraded rendering warnings shall allow valid renderable elements to remain visible and
shall make the warnings available from the canvas view.

Rejected user actions shall leave the persisted document unchanged and show a concise
problem message near the action location or in a canvas-level notification area.

Persistence errors shall follow the canvas persistence specification and shall be
reported without silently discarding the user's last visible edit.

Version 1 canvas behavior excludes:

- Automatic layout.
- Multi-user editing.
- Multi-selection editing.
- Grouping elements.
- Layer management or custom z-index.
- Freehand drawing.
- Full HTML editing for notes beyond the basic rendering subset.
- Editing ontology source files from the canvas.
