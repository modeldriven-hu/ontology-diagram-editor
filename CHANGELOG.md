# Change Log

All notable changes to the "ontology-diagram-editor" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Fixed exported edge, cardinality, and standalone label positioning, text clipping,
  and content bounds.
- Removed the redundant full diagram path from the canvas header.
- Docked the fixed canvas toolbar to the top by default for newly opened diagrams.

## [1.4.1] - 2026-07-26

- Added configurable node-label truncation and wrapping on the canvas and in exports.
- Moved label overflow and containment presentation controls into the Style tab.
- Added shared style editing for multiple selected nodes, including mixed-value fields
  and atomic batch persistence.
- Added actions for narrowing mixed canvas selections to nodes, edges, notes, images,
  labels, diagram information, or legends.

## [1.4.0] - 2026-07-26

- Added recursive containment presentation for ontology relationships, including
  explicit container direction, validation, compound layout, and export support.
- Added hierarchy-aware arrangement for nested containment trees.
- Improved containment colors in light and dark themes.

## [1.3.0] - 2026-07-21

- Added a searchable offline gallery containing Material Design Icons, Bootstrap Icons,
  and IBM Carbon, including extensive IT and cloud coverage and recolorable SVG icons.
- Added a dedicated Properties view in the left sidebar and simplified its controls.
- Added a pan mode to the canvas toolbar.
- Added image fit options and improved image rendering in the canvas and exported files.
- Updated gallery icon colors when the legend's coloring mode changes.

## [1.2.0] - 2026-07-17

- Added model-tree multi-selection drag and drop to the diagram canvas.
- Added legend coloring by ontology item type.
- Added Select All keyboard support for canvas elements.
- Added model-tree actions to add all ontology elements to a diagram.
- Made the canvas toolbar dockable.

## [1.1.0] - 2026-07-14

- Added ontology legends with a configurable 20-color palette.
- Added per-ontology color customization and selectable node border or background coloring.
- Added automatic contrasting node text colors when ontology colors are applied to backgrounds.
- Added configurable ontology labels at the top of nodes, using declared ontology names.
- Added multi-selection drag-and-drop from the model tree to the diagram canvas.

## [1.0.0]

- Initial release
