# Acceptance Tests: Canvas Background And Grid

- Given `canvas_background` is omitted or `theme`, when the diagram is rendered or exported, then the current themed canvas background is used.
- Given `canvas_background` is `white`, when a light-mode diagram is rendered or exported, then its background is opaque white.
- Given `canvas_background` is `white`, when a dark-mode diagram is rendered or exported, then its background is opaque black.
- Given `canvas_background` is `transparent`, when the diagram is rendered or exported, then no opaque background is introduced.
- Given Background is changed in Diagram properties, when the document is saved, then the selected value is persisted in metadata.
- Given `show_grid` is omitted or true, when the editor canvas is displayed in light or dark mode, then the same subtle dot-grid pattern is visible.
- Given `show_grid` is false, when the editor canvas is displayed, then its dot grid is hidden.
- Given Show Dot Grid is changed in Diagram properties, when the document is saved, then the value is persisted in metadata.
- Given any grid visibility setting, when SVG or PNG is exported, then the editing grid is not included.
