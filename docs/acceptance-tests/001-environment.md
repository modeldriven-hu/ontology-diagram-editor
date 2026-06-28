# Acceptance Tests: Environment

## Visual Studio Code Extension

- Given the extension is installed, when a user opens a `.odiagram` file, then the tool can open a diagram editor webview for that file.
- Given the extension is installed, when a user edits a `.odiagram` file as text, then the file remains a normal Visual Studio Code text document.
- Given the extension is installed, when the diagram editor is opened, then canvas, model tree, and command behavior are available from the extension.

## Implementation Platform

- Given the project is built, when the extension entry point is compiled, then it is implemented in TypeScript.
