# Canvas Export

This specification defines SVG and PNG export behavior from the canvas view.

# Scope

This specification covers export actions, exported content, image handling, note export
visibility, output naming, and save behavior. It does not define `.odiagram`
persistence, interactive canvas rendering, or theme file editing.

# Export Actions

The canvas toolbar shall provide export actions for SVG and PNG.

If the opened diagram has no exportable content, the export action shall show a concise
user-visible message and shall not open a save target or write a file.

If the user chooses an export action for a non-empty diagram, the canvas shall create an
export using the currently selected light or dark theme mode and then ask the user for a
target file path through the Visual Studio Code save dialog. If the user cancels the
save dialog, no file shall be written.

# Exported Content

The export shall include:

- Ontology-backed nodes.
- Ontology-backed and note-connection edges.
- Standalone images.
- Standalone labels.
- Notes whose effective `export` value is `true`.

Notes with `export: false` shall be omitted from the exported image. Omitting a note
from the export shall not remove connected note-connection edges unless those edges are
otherwise excluded by a future feature.

The export shall compute its bounds from visible exported content, add an
implementation-defined margin, and set the exported image dimensions to the resulting
content bounds.

The export shall use the same draw order as the interactive renderer: images, edges,
nodes, export-included notes, and standalone labels.

# SVG Export

SVG export shall write a UTF-8 `.svg` file.

The SVG shall contain the resolved visual geometry, text, styles, edge markers, and
embedded note HTML needed to render the diagram without requiring the VS Code webview.
Images shall use their persisted source values in the SVG. Data URI image sources shall
therefore remain embedded in the export.

# PNG Export

PNG export shall first produce the same SVG representation using webview-safe image
references, rasterize it in the webview, and write the resulting PNG bytes to a `.png`
file.

The PNG export should use a scale factor high enough to avoid visibly blurry output on
high-density displays.

# Output Names And Save Behavior

The default export file name shall be derived from the opened `.odiagram` file name. If
no usable file name is available, the default shall be `ontology-diagram`.

Saving an export shall not modify the opened `.odiagram` document and shall not
participate in `.odiagram` undo or redo history.

After a successful save, the extension shall show a user-visible confirmation containing
the saved target path.
