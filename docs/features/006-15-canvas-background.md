# Canvas Background And Grid

This specification defines diagram-level canvas background and grid presentation.

# Background

The Diagram properties shall provide a Background selection with these choices:

- `theme`: use the current light or dark theme canvas background. This is the default
  for diagrams that omit `canvas_background`.
- `white`: use an opaque white canvas background in light mode and an opaque black
  canvas background in dark mode.
- `transparent`: use a transparent canvas background.

The selected value shall be persisted as metadata `canvas_background` and shall apply
to the live canvas and SVG/PNG exports. A transparent PNG export shall preserve its
alpha channel.

# Grid

The Diagram properties shall provide a Show Dot Grid checkbox. The same subtle dot
pattern shall be used in light and dark modes. The dot grid shall be visible when
metadata `show_grid` is omitted or true. When it is false, the dots shall not be drawn
on the editor canvas. The dot grid is an editing aid and shall not be included in
exports.
