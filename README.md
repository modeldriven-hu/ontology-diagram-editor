# Ontology Diagram Editor

Ontology Diagram Editor is a Visual Studio Code extension for creating and editing
ontology-backed diagrams. It opens `.odiagram` YAML files in a custom webview editor,
loads referenced ontology files into a model tree, and lets you build diagrams by
placing ontology items, relationships, notes, images, and labels on a canvas.

## Features

- Create valid empty `.odiagram` files from the Command Palette or from an Explorer
  folder context menu.
- Open `.odiagram` files as either text or an interactive canvas editor.
- Reference ontology files from a diagram and browse them in the Ontology Diagram model
  tree.
- Load ontology items into groups for classes, object properties, object-property
  assertions, data properties, annotation properties, subclass relationships,
  individuals, and datatypes.
- Add and remove referenced ontology files from the model tree.
- Open ontology source files and reveal the best available source location for a model
  tree item.
- Drag ontology items from the model tree onto the canvas to create nodes or
  relationship edges.
- Search ontology items from the canvas toolbar and add the selected node or
  relationship at the current viewport without using drag and drop.
- Materialize object property, object-property assertion, data property, and subclass
  relationship edges, including missing endpoint nodes. When a property has multiple
  source or target references, choose the intended endpoints before materializing it.
- Render ontology-backed nodes and edges with UML-style conventions.
- Add, edit, move, resize, and delete notes, standalone labels, and standalone images.
- Connect notes to nodes, images, or other notes with persisted annotation edges.
- Select canvas elements with modifiers or a marquee, move them with the keyboard, and
  move multiple selected elements together by keyboard or drag.
- Align, resize-match, distribute, and arrange selected ontology nodes; align shared
  edge endpoints and generalization sets.
- Inspect and edit selected element geometry, text, image sources, route layout, export
  inclusion, data-property visibility, and style overrides in the property panel.
- Customize element-level style for nodes, edges, notes, labels, and image borders or
  shadows without editing the referenced theme file.
- Use `.otheme` YAML files for reusable visual defaults, with light and dark mode
  overrides.
- Automatically reload referenced ontology and theme files when they change, or reload
  them explicitly through Refresh Diagram Dependencies.
- Toggle the rendered light or dark theme mode and persist the selected mode in
  `.odiagram` metadata.
- Pan, zoom, fit, and reset the canvas viewport without changing persisted coordinates.
- Arrange ontology-backed nodes and reroute connected edges through a toolbar action.
- Export non-empty diagrams as SVG or PNG.
- Persist completed canvas edits back to the opened `.odiagram` document, preserving
  unknown fields whenever practical.

The `.odiagram` format is YAML-based and stores diagram metadata, ontology references,
namespace shortcuts, positioned nodes and edges, plus optional notes, images, labels,
and element-level style overrides. Relative ontology and theme paths are resolved from
the `.odiagram` file.

Images added through the canvas are embedded as data URI sources so diagrams remain
portable. Relative image paths and remote image URLs are not supported in version 1.

Detailed feature specifications are available in `docs/features/`.

## Requirements

- Visual Studio Code `^1.125.0`.
- Ontology files referenced by a diagram should be reachable from the `.odiagram` file.
- Supported ontology input formats include Turtle (`.ttl`), RDF/XML (`.rdf`, `.owl`,
  `.xml`), JSON-LD (`.jsonld`), and N-Triples (`.nt`).
- Optional theme files are YAML files, preferably using the `.otheme.yml` extension.

## Extension Settings

This extension does not currently contribute VS Code settings.

## Known Issues

Current version 1 scope intentionally excludes:

- Multi-user editing.
- Grouping elements, layer management, custom z-index controls, and freehand drawing.
- Direct ontology source editing from canvas controls.
- Theme file editing from canvas controls.
- Annotation property edge creation.
- Direct property-panel editing of element identifiers, ontology references, edge
  endpoints, edge route points, or edge label positions.

## Release Notes

### 0.0.1

Initial development release with `.odiagram` custom editor support, ontology model tree,
canvas editing, property panel editing, theming, persistence, and SVG/PNG export.

---

## Following extension guidelines

This repository follows the standard Visual Studio Code extension layout. Extension
entry points live in `src/`, feature and acceptance-test notes live in `docs/`, and the
development bundle is produced into `dist/` by `esbuild.js`.

Useful development commands:

- `npm install`: install dependencies from `package-lock.json`.
- `npm run compile`: type-check, lint, and bundle the extension.
- `npm run watch`: run TypeScript and esbuild watchers during development.
- `npm test`: compile tests, compile the extension, lint, and run VS Code extension
  tests.
- `npm run package`: build a production bundle.

To build an installable Visual Studio Code plugin file (`.vsix`):

```sh
npm install
npm run package
npx @vscode/vsce package
```

`npm run package` creates the production bundle in `dist/`. `npx @vscode/vsce package`
then creates the `.vsix` file in the project root, using `.vscodeignore` to decide what
is included. If VSCE reports missing marketplace metadata, add the required fields such
as `publisher` to `package.json` before packaging.

See also the Visual Studio Code [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines).

## Working with Markdown

The main project documentation is Markdown:

- Feature specifications: `docs/features/`.
- Acceptance-test notes: `docs/acceptance-tests/`.
- Diagram documentation: `docs/diagrams/`.

You can preview Markdown in Visual Studio Code with `Shift+Cmd+V` on macOS or
`Shift+Ctrl+V` on Windows and Linux.

## For more information

- [Visual Studio Code Extension API](https://code.visualstudio.com/api)
- [Custom editors](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Markdown support in Visual Studio Code](https://code.visualstudio.com/docs/languages/markdown)
