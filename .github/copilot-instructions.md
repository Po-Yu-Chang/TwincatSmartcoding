## VS Code Extension: TwinCAT File Editor

This document provides instructions for GitHub Copilot to assist in the development of a VS Code extension for editing TwinCAT files.

**File Types to Support:**

*   `.tcdut` (TwinCAT Data Unit Type)
*   `.tcgvl` (TwinCAT Global Variable List)
*   `.tcpou` (TwinCAT Program Organization Unit)

**Core Functionality:**

The primary goal is to create a custom editor with a split view:

1.  **Declarations View:** A read-only or editable (TBD) text area displaying the variable declaration part of the TwinCAT file.
2.  **Code View:** An editable text area displaying the program code (implementation) part of the TwinCAT file.

**Development Steps:**

1.  **`package.json` Configuration:**
    *   **Activation Events:**
        *   Register a command (e.g., `twincat-editor.openEditor`) to manually open the custom editor.
        *   Consider `onLanguage:tcdut`, `onLanguage:tcgvl`, `onLanguage:tcpou` for automatic editor opening when these file types are focused, or use `onDidOpenTextDocument`.
    *   **Custom Editors:**
        *   Define a `customEditors` contribution for the supported file types. Specify `viewType` (e.g., `twincat.editor`) and `displayName`.
    *   **Language Contributions:**
        *   Define languages for `.tcdut`, `.tcgvl`, and `.tcpou`.
            *   `id`: e.g., `tcdut`, `tcgvl`, `tcpou`
            *   `aliases`: e.g., ["TwinCAT DUT", "tcdut"]
            *   `extensions`: [".tcdut"], [".tcgvl"], [".tcpou"] (ensure case-insensitivity if possible, or handle in code)
            *   `configuration`: (Optional) Path to a language configuration file for basic syntax highlighting or commenting if desired later.
    *   **Commands:**
        *   Define the command registered in activation events.

2.  **Extension Entry Point (`src/extension.ts`):**
    *   **`activate` function:**
        *   Register the command that will open the custom editor.
        *   Register a `CustomTextEditorProvider` (or a similar mechanism like `WebviewPanelSerializer` if managing webviews directly).
    *   **`deactivate` function:** (Optional) Clean up resources.

3.  **Custom Editor Implementation (e.g., `src/tcEditorProvider.ts`):**
    *   Implement `vscode.CustomTextEditorProvider`.
    *   **`resolveCustomTextEditor` method:**
        *   This method is called when a file of a supported type is opened with the custom editor.
        *   It receives the `TextDocument` and a `WebviewPanel`.
        *   **File Parsing:**
            *   Read the content of the `TextDocument`.
            *   Implement logic to parse the content and split it into "declarations" and "code" sections.
                *   For `.tcpou` files, declarations are typically between `PROGRAM ... VAR` and `END_VAR`, and code is after `END_VAR` and before `END_PROGRAM`. Similar patterns exist for `FUNCTION_BLOCK`, `FUNCTION`.
                *   For `.tcdut` files, it's mainly declarations within `TYPE ... : STRUCT` and `END_STRUCT; END_TYPE`.
                *   For `.tcgvl` files, it's declarations within `VAR_GLOBAL ... END_VAR`.
                *   Consider using regular expressions or a simple state machine for parsing.
        *   **Webview Setup:**
            *   Set the `webviewPanel.webview.html` with the structure for the split view (e.g., two `<textarea>` elements or divs acting as editors, potentially using a lightweight editor component later).
            *   Pass the parsed declarations and code to the webview using `webview.postMessage()`.
        *   **Message Handling (from webview to extension):**
            *   Listen for messages from the webview (e.g., when content in the "code" textarea changes) using `webviewPanel.webview.onDidReceiveMessage()`.
            *   When a "save" or "contentChanged" message is received:
                *   Retrieve the updated declarations (if editable) and code from the message payload.
                *   Reconstruct the full file content.
                *   Create a `WorkspaceEdit` to apply the changes to the `TextDocument`.
                *   Use `vscode.workspace.applyEdit()` to save the changes.
        *   **Document Change Handling (from VS Code to webview):**
            *   Listen for `vscode.workspace.onDidChangeTextDocument`. If the change affects the current document, re-parse and update the webview. This handles external changes to the file.

4.  **Webview HTML (`getHtmlForWebview` function):**
    *   Create HTML with two main areas (e.g., textareas or divs).
    *   Include a script (`<script>`) to:
        *   Receive initial data (declarations, code) from the extension via `acquireVsCodeApi()` and `window.addEventListener('message', event => { ... })`.
        *   Populate the textareas/divs.
        *   Send messages back to the extension when content changes (e.g., on `input` event of the code textarea) using `vscode.postMessage({ type: 'codeChanged', value: newCode })`.
        *   Potentially include a "Save" button that explicitly triggers a message to save.

**Parsing Logic Details:**

*   **General Approach:**
    *   Identify start and end markers for declaration blocks (e.g., `VAR`...`END_VAR`, `TYPE`...`END_TYPE`, `VAR_GLOBAL`...`END_VAR`).
    *   The content before the first declaration block might be part of the POU definition (e.g., `PROGRAM <name>`).
    *   The content after the last declaration block and before the POU end marker (e.g., `END_PROGRAM`) is the code.
*   **Case Insensitivity:** TwinCAT syntax is generally case-insensitive for keywords. Parsing logic should account for this (e.g., convert to uppercase before matching keywords).
*   **Comments:** Be mindful of how comments (`(* ... *)`, `// ...`) might affect parsing. Initially, a simpler parser might ignore them or treat them as part of the code/declaration block they reside in.

**Error Handling and Edge Cases:**

*   Files that don't perfectly match the expected structure.
*   Empty files or files with only declarations/code.

**Build and Test:**

*   Use `npm run compile` or `npm run watch` for building.
*   Press `F5` to launch a new Extension Development Host window with the extension loaded.
*   Open/create `.tcdut`, `.tcgvl`, `.tcpou` files to test.

**Future Enhancements (Optional):**

*   Syntax highlighting within the webview textareas (could use a library like Monaco Editor, CodeMirror, or a simpler custom solution for basic highlighting).
*   More robust parsing.
*   Direct editing of declarations with updates reflected in the file.
*   Configuration options (e.g., default split ratio).

**Key VS Code API:**

*   `vscode.window.registerCustomEditorProvider`
*   `vscode.CustomTextEditorProvider`
*   `vscode.WebviewPanel`
*   `vscode.TextDocument`
*   `vscode.workspace.applyEdit`
*   `vscode.WorkspaceEdit`
*   `webview.postMessage`
*   `webview.onDidReceiveMessage`
*   `acquireVsCodeApi` (in webview script)
