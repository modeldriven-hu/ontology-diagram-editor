# Modular maintainability acceptance

These checks ensure the module extraction preserves externally visible behavior.

1. Run `npm run compile` and confirm type checking, linting, extension bundling, webview bundling, and CSS asset copying succeed.
2. Open an existing `.odiagram` file and confirm the model tree, canvas, local toolbar, property panel, keyboard shortcuts, pan/zoom, and persisted viewport still initialize.
3. Edit nodes, edges, notes, images, labels, metadata, legends, and styles; confirm undo, redo, deletion, and YAML persistence behave as before.
4. Export the same diagram as SVG and PNG and confirm image fit, note connections, corner radii, labels, and export bounds agree with the interactive canvas.
5. Run `npm test` and confirm the capability-focused test files execute under the VS Code test runner.
