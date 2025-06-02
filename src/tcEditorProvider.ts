import * as vscode from 'vscode';

interface ParsedTcDocument {
    declarations: string;
    code: string;
    prefix: string; // Content before declarations start (e.g., PROGRAM name VAR)
    suffix: string; // Content after code ends (e.g., END_PROGRAM)
    declarationBlockEndMarker: string; // e.g., END_VAR or END_STRUCT; END_TYPE
}

export class TcEditorProvider implements vscode.CustomTextEditorProvider {

    public static readonly viewType = 'twincat.editor';

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        const updateWebview = () => {
            const parsedDoc = this.parseDocument(document);
            webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document, parsedDoc);
        };

        updateWebview(); // Initial load

        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'contentChanged':
                        const newContent = this.reconstructFileContent(
                            message.declarations,
                            message.code,
                            message.prefix,
                            message.suffix,
                            message.declarationBlockEndMarker,
                            document.fileName.toLowerCase()
                        );
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(
                            document.uri,
                            new vscode.Range(0, 0, document.lineCount, 0),
                            newContent
                        );
                        await vscode.workspace.applyEdit(edit);
                        // After applying edit, the document object might be stale.
                        // VS Code should provide the updated document in onDidChangeTextDocument.
                        return;
                    case 'save':
                        await document.save();
                        vscode.window.showInformationMessage('File saved!');
                        return;
                    case 'error':
                        vscode.window.showErrorMessage(message.value);
                        return;
                }
            }
        );

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                console.log('Document changed externally, updating webview for:', document.uri.fsPath);
                updateWebview(); // Re-parse and update webview
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    private parseDocument(document: vscode.TextDocument): ParsedTcDocument {
        const content = document.getText();
        const contentUpperCase = content.toUpperCase();
        const fileNameLowerCase = document.fileName.toLowerCase();

        let declarations = "";
        let code = "";
        let prefix = "";
        let suffix = "";
        let declarationBlockEndMarker = "";

        if (fileNameLowerCase.endsWith('.tcpou')) {
            declarationBlockEndMarker = "END_VAR";
            const pouKeywords = ["PROGRAM", "FUNCTION_BLOCK", "FUNCTION"];
            let pouTypeKeyword = "";
            for (const kw of pouKeywords) {
                if (contentUpperCase.startsWith(kw)) {
                    pouTypeKeyword = kw;
                    break;
                }
            }

            const varRegex = new RegExp(`^(.*?${pouTypeKeyword}[^\\S\\r\\n]+.*?\\r?\\n[^\\S\\r\\n]*VAR)(.*?)(\\r?\\n[^\\S\\r\\n]*END_VAR)(.*?)(END_${pouTypeKeyword})$`, "is");
            // is: i for case-insensitive, s for dot matches newline (though not strictly needed here with (.*?) for content)

            const match = content.match(varRegex);

            if (match) {
                prefix = match[1]; // e.g., "PROGRAM Main\nVAR" (original casing)
                declarations = match[2].trim(); // Content between VAR and END_VAR
                // match[3] is the END_VAR block itself, including leading/trailing whitespace/newlines
                code = match[4].trim(); // Content between END_VAR and END_POUTYPE
                suffix = match[5]; // e.g., "END_PROGRAM" (original casing)
            } else {
                // Fallback: try to find at least VAR...END_VAR
                const varStartIndex = contentUpperCase.indexOf("VAR");
                const endVarIndex = contentUpperCase.indexOf("END_VAR");
                if (varStartIndex !== -1 && endVarIndex > varStartIndex) {
                    const pouDefEndIndex = varStartIndex; // Approx.
                    prefix = content.substring(0, pouDefEndIndex);
                    // Find the actual "VAR" keyword with original casing
                    const actualVarKeywordMatch = content.substring(pouDefEndIndex).match(/VAR/i);
                    if (actualVarKeywordMatch && actualVarKeywordMatch.index !== undefined) {
                         prefix = content.substring(0, pouDefEndIndex + actualVarKeywordMatch.index + actualVarKeywordMatch[0].length);
                    }

                    declarations = content.substring(prefix.length, endVarIndex).trim();
                    const codeStartIndex = endVarIndex + "END_VAR".length;
                    const endPouIndex = contentUpperCase.lastIndexOf(`END_${pouTypeKeyword}`);
                    if (endPouIndex > codeStartIndex) {
                        code = content.substring(codeStartIndex, endPouIndex).trim();
                        suffix = content.substring(endPouIndex);
                    } else {
                        code = content.substring(codeStartIndex).trim();
                        suffix = "";
                    }
                } else {
                    // Simplest fallback
                    code = content;
                }
            }
        } else if (fileNameLowerCase.endsWith('.tcdut')) {
            declarationBlockEndMarker = "END_STRUCT;"; // Note: END_TYPE is separate or part of suffix
            const dutRegex = /^(.*?TYPE[^\\S\\r\\n]+.*?\\r?\\n[^\\S\\r\\n]*STRUCT)(.*?)(\\r?\\n[^\\S\\r\\n]*END_STRUCT;\\s*END_TYPE.*?)$/is;
            const match = content.match(dutRegex);
            if (match) {
                prefix = match[1]; // TYPE ... STRUCT
                declarations = match[2].trim(); // Declarations
                suffix = match[3]; // END_STRUCT; END_TYPE ...
            } else {
                declarations = content; // Treat all as declaration
            }
        } else if (fileNameLowerCase.endsWith('.tcgvl')) {
            declarationBlockEndMarker = "END_VAR";
            const gvlRegex = /^(.*?VAR_GLOBAL)(.*?)(\\r?\\n[^\\S\\r\\n]*END_VAR.*?)$/is;
            const match = content.match(gvlRegex);
            if (match) {
                prefix = match[1]; // VAR_GLOBAL
                declarations = match[2].trim(); // Declarations
                suffix = match[3]; // END_VAR ...
            } else {
                declarations = content; // Treat all as declaration
            }
        } else {
            code = content; // Default for unknown
        }

        return { declarations, code, prefix, suffix, declarationBlockEndMarker };
    }

    private reconstructFileContent(
        declarations: string,
        code: string,
        prefix: string,
        suffix: string,
        declarationBlockEndMarker: string,
        fileNameLowerCase: string
    ): string {
        declarations = declarations.trim(); // Ensure no leading/trailing whitespace from textarea
        code = code.trim();

        if (fileNameLowerCase.endsWith('.tcpou')) {
            // Ensure there's a newline after prefix if it doesn't end with one,
            // and before END_VAR if declarations are not empty.
            // Similar for code and suffix.
            let reconstructed = prefix.trimEnd();
            if (declarations) {
                reconstructed += (reconstructed.endsWith('\\n') ? '' : '\\n') + declarations.trim() + (declarations.endsWith('\\n') ? '' : '\\n') + declarationBlockEndMarker;
            } else {
                 reconstructed += (reconstructed.endsWith('\\n') ? '' : '\\n') + declarationBlockEndMarker;
            }
            if (code) {
                reconstructed += (reconstructed.endsWith('\\n') ? '' : '\\n') + code.trim();
            }
            reconstructed += (reconstructed.endsWith('\\n') || !suffix.trimStart() ? '' : '\\n') + suffix.trimStart();
            return reconstructed;

        } else if (fileNameLowerCase.endsWith('.tcdut')) {
            // TYPE ... STRUCT \n declarations \n END_STRUCT; END_TYPE
            let reconstructed = prefix.trimEnd();
            if (declarations) {
                 reconstructed += (reconstructed.endsWith('\\n') ? '' : '\\n') + declarations.trim();
            }
            // Suffix already contains END_STRUCT; END_TYPE
            reconstructed += (reconstructed.endsWith('\\n') || !suffix.trimStart() ? '' : '\\n') + suffix.trimStart();
            return reconstructed;

        } else if (fileNameLowerCase.endsWith('.tcgvl')) {
            // VAR_GLOBAL \n declarations \n END_VAR
            let reconstructed = prefix.trimEnd();
            if (declarations) {
                reconstructed += (reconstructed.endsWith('\\n') ? '' : '\\n') + declarations.trim();
            }
             // Suffix already contains END_VAR
            reconstructed += (reconstructed.endsWith('\\n') || !suffix.trimStart() ? '' : '\\n') + suffix.trimStart();
            return reconstructed;
        }
        return declarations + "\\n" + code; // Fallback
    }

    private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument, parsedDoc: ParsedTcDocument): string {
        const nonce = getNonce();
        const { declarations, code, prefix, suffix, declarationBlockEndMarker } = parsedDoc;

        const stylesPathMain = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css');
        const stylesUri = webview.asWebviewUri(stylesPathMain);

        // Pass the parsed parts to the webview script
        const webviewState = {
            declarations: escapeHtml(declarations),
            code: escapeHtml(code),
            prefix: escapeHtml(prefix),
            suffix: escapeHtml(suffix),
            declarationBlockEndMarker: escapeHtml(declarationBlockEndMarker),
            fileName: document.fileName.toLowerCase()
        };

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <link href="${stylesUri}" rel="stylesheet">
                <title>TwinCAT Editor</title>
            </head>
            <body>
                <div class="editor-container">
                    <div class="declarations-view">
                        <h2>Declarations</h2>
                        <textarea id="declarations-area" rows="10">${escapeHtml(declarations)}</textarea>
                    </div>
                    <div class="code-view">
                        <h2>Code</h2>
                        <textarea id="code-area" rows="20">${escapeHtml(code)}</textarea>
                    </div>
                </div>
                <button id="save-button">Save Changes</button>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const declarationsArea = document.getElementById('declarations-area');
                    const codeArea = document.getElementById('code-area');
                    const saveButton = document.getElementById('save-button');

                    // Restore initial state from the extension
                    const initialState = ${JSON.stringify(webviewState)};
                    declarationsArea.value = unescapeHtml(initialState.declarations);
                    codeArea.value = unescapeHtml(initialState.code);
                    
                    let currentPrefix = unescapeHtml(initialState.prefix);
                    let currentSuffix = unescapeHtml(initialState.suffix);
                    let currentDeclEndMarker = unescapeHtml(initialState.declarationBlockEndMarker);
                    const currentFileName = initialState.fileName;

                    function unescapeHtml(safe) {
                        if (typeof safe !== 'string') return safe;
                        return safe
                            .replace(/&amp;/g, "&")
                            .replace(/&lt;/g, "<")
                            .replace(/&gt;/g, ">")
                            .replace(/&quot;/g, '"')
                            .replace(/&#039;/g, "'");
                    }

                    function sendContentChanged() {
                        vscode.postMessage({
                            type: 'contentChanged',
                            declarations: declarationsArea.value,
                            code: codeArea.value,
                            prefix: currentPrefix, // Send back the original prefix
                            suffix: currentSuffix, // Send back the original suffix
                            declarationBlockEndMarker: currentDeclEndMarker // Send back the original marker
                        });
                    }

                    declarationsArea.addEventListener('input', sendContentChanged);
                    codeArea.addEventListener('input', sendContentChanged);

                    saveButton.addEventListener('click', () => {
                        // The contentChanged message already sends the latest state.
                        // If we want an explicit save action to *also* send the state,
                        // we can call sendContentChanged() here too, or rely on the extension
                        // to use the latest TextDocument content if save is just a trigger.
                        // For simplicity, let's ensure the latest is sent before save.
                        sendContentChanged(); 
                        vscode.postMessage({ type: 'save' });
                    });

                    // Handle messages from the extension (e.g., for external updates)
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'updateFromExtension': // Sent by extension on external file change
                                declarationsArea.value = unescapeHtml(message.declarations);
                                codeArea.value = unescapeHtml(message.code);
                                currentPrefix = unescapeHtml(message.prefix);
                                currentSuffix = unescapeHtml(message.suffix);
                                currentDeclEndMarker = unescapeHtml(message.declarationBlockEndMarker);
                                break;
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
