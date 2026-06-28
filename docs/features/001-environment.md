# The tool's environment

This document defines the high-level runtime environment supported by the tool. Detailed
behavior for file formats, rendering, editor interaction, commands, and model tree
functionality is specified in separate feature documents.

The tool shall run as a Visual Studio Code extension in version 1.

## Visual Studio Code usage

The tool can be installed as a Visual Studio Code extension. It allows users to create
diagram files with the `.odiagram` extension, edit them as text, and open them in a
webview for diagram-specific actions similar to Markdown preview functionality.

# Programming language and library

The tool shall be written in TypeScript and shall work as a standard Visual Studio Code
extension.
