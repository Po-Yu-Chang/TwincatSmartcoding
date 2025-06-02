import * as vscode from 'vscode';

interface ParsedTcDocument {
    /** POU-level <Declaration><![CDATA[ ... ]]></Declaration> 內部純文字 */
    declarations: string;
    /** POU-level <Implementation>…<ST><![CDATA[ ... ]]></ST>…</Implementation> 內部純文字 */
    code: string;
    /** 從檔頭到 POU-level <Declaration> 開始之前的所有 XML */
    prefix: string;
    /** 從 POU-level </Implementation> 結束之後到檔尾的所有 XML */
    suffix: string;
    /** （備用，代表 CDATA 結尾標記） */
    declarationBlockEndMarker: string;
}

export class TcEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'twincat.editor';

    constructor(private readonly context: vscode.ExtensionContext) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // 啟用 Webview 裡的 script
        webviewPanel.webview.options = { enableScripts: true };

        // (1) 先 parse 一次，將最上層 POU Declaration/CDAT A 和 Implementation→ST CDATA 拆出
        let parsedDoc = this.parseDocument(document);

        // (2) 把 HTML 寫給 Webview，左右兩欄顯示 declarations / code
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document, parsedDoc);

        // 當 Webview postMessage 過來
        webviewPanel.webview.onDidReceiveMessage(async message => {
            switch (message.type) {
                case 'contentChanged':
                    {
                        // 使用者按下「Save Changes」，拿到新的 declarations & code
                        const newContent = this.reconstructFileContent(
                            message.declarations,
                            message.code,
                            parsedDoc.prefix,
                            parsedDoc.suffix,
                            parsedDoc.declarationBlockEndMarker,
                            document.fileName.toLowerCase()
                        );
                        // 用 WorkspaceEdit 全檔取代
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(
                            document.uri,
                            new vscode.Range(0, 0, document.lineCount, 0),
                            newContent
                        );
                        await vscode.workspace.applyEdit(edit);
                        // applyEdit 後，會觸發 onDidChangeTextDocument，再做一次更新
                    }
                    return;

                case 'save':
                    // Webview 按下「Save File」，實際把檔案寫進硬碟
                    await document.save();
                    vscode.window.showInformationMessage('📂 File saved!');
                    return;

                case 'error':
                    vscode.window.showErrorMessage(message.value);
                    return;
            }
        });

        // 監聽 document 內容修改（包含 applyEdit、外部改動）
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                parsedDoc = this.parseDocument(document);
                webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document, parsedDoc);
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    /**
     * 解析 TextDocument，抓最上層 POU 的 Declaration CDATA 內文，以及最上層 POU 的 Implementation→ST CDATA 內文
     */
    private parseDocument(document: vscode.TextDocument): ParsedTcDocument {
        const content = document.getText();
        const fileNameLowerCase = document.fileName.toLowerCase();

        let declarations = "";
        let code = "";
        let prefix = "";
        let suffix = "";
        let declarationBlockEndMarker = "";

        if (fileNameLowerCase.endsWith('.tcpou') || fileNameLowerCase.endsWith('.xml')) {
            // (1) 抓最上層 POU 的 Declaration CDATA 內文
            const declRegex = /<Declaration>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/Declaration>/i;
            const declMatch = declRegex.exec(content);
            if (declMatch) {
                const fullDeclMatch = declMatch[0];
                const inner = declMatch[1];
                declarations = inner.trim();
                declarationBlockEndMarker = "</Declaration>";
                const declStartIndex = declMatch.index;
                prefix = content.substring(0, declStartIndex);

                // (2) 抓最上層 POU 的 Implementation→ST CDATA 內文
                const afterDeclPos = declStartIndex + fullDeclMatch.length;
                const implRegex = /<Implementation>[\s\S]*?<ST>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/ST>[\s\S]*?<\/Implementation>/i;
                const subAfterDecl = content.substring(afterDeclPos);
                const implMatch = implRegex.exec(subAfterDecl);
                if (implMatch) {
                    const fullImplMatch = implMatch[0];
                    const innerCode = implMatch[1];
                    code = innerCode.trim();
                    const implStartIndex = afterDeclPos + implMatch.index;
                    const implEndIndex = implStartIndex + fullImplMatch.length;
                    suffix = content.substring(implEndIndex);
                }
            }
        } else {
            // 非 .tcpou/.xml，則全部當 code
            code = content;
        }

        return {
            declarations,
            code,
            prefix,
            suffix,
            declarationBlockEndMarker
        };
    }

    /**
     * 將新的 declarations / code 重新包回最上層 POU 的 XML 結構
     */
    private reconstructFileContent(
        declarations: string,
        code: string,
        prefix: string,
        suffix: string,
        declarationBlockEndMarker: string,
        fileNameLowerCase: string
    ): string {
        if (fileNameLowerCase.endsWith('.tcpou') || fileNameLowerCase.endsWith('.xml')) {
            // 把 declarations 包成 CDATA
            const declCData =
                `<Declaration><![CDATA[\n${declarations.trim()}\n]]></Declaration>`;
            // 把 code 包成 Implementation→ST CDATA
            const codeCData =
                `<Implementation>\n` +
                `    <ST><![CDATA[\n${code.trim()}\n]]></ST>\n` +
                `</Implementation>`;
            // 拼回 prefix + declCData + codeCData + suffix
            return prefix.trimEnd() + "\n" +
                   declCData + "\n" +
                   codeCData + "\n" +
                   suffix.trimStart();
        }
        // fallback
        return declarations + "\n" + code;
    }

    /**
     * 產生 Webview HTML：上下有 Save 按鈕，左右分別是 Declaration / Code 兩個 textarea
     */
    private getHtmlForWebview(
        webview: vscode.Webview,
        document: vscode.TextDocument,
        parsedDoc: ParsedTcDocument
    ): string {
        const nonce = getNonce();
        const { declarations, code } = parsedDoc;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charsetSet-Location -LiteralPath {your_project_directory}="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Twincat POU Editor</title>
    <style>
        body, html {
            margin: 0; padding: 0; height: 100%; width: 100%;
            display: flex; flex-direction: column;
            font-family: Consolas, 'Courier New', monospace;
        }
        #toolbar {
            background: #f2f2f2;
            padding: 6px;
            border-bottom: 1px solid #ccc;
        }
        #container {
            flex: 1;
            display: flex;
            flex-direction: row;
        }
        .pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            border-right: 1px solid #ddd;
        }
        .pane:last-child {
            border-right: none;
        }
        .pane h2 {
            margin: 4px;
            font-size: 14px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 2px;
        }
        .pane textarea {
            flex: 1;
            width: 100%;
            resize: none;
            font-family: inherit;
            font-size: 13px;
            padding: 8px;
            box-sizing: border-box;
        }
        #save-button {
            font-size: 13px;
            padding: 4px 8px;
        }
    </style>
</head>
<body>
    <div id="toolbar">
        <button id="save-button">💾 Save Changes</button>
    </div>
    <div id="container">
        <div class="pane">
            <h2>📝 Declarations (POU-level)</h2>
            <textarea id="declarations-area" placeholder="No Declaration found…">${escapeHtml(declarations)}</textarea>
        </div>
        <div class="pane">
            <h2>💻 Code (ST, POU-level)</h2>
            <textarea id="code-area" placeholder="No ST Implementation found…">${escapeHtml(code)}</textarea>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        document.getElementById('save-button').addEventListener('click', () => {
            vscode.postMessage({
                type: 'contentChanged',
                declarations: document.getElementById('declarations-area').value,
                code: document.getElementById('code-area').value,
            });
        });

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.type === 'init') {
                document.getElementById('declarations-area').value = msg.declarations;
                document.getElementById('code-area').value = msg.code;
            }
        });
    </script>
</body>
</html>`;
    }
}

/**
 * 產生 Webview 用的 nonce
 */
function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * 將字串 escape 成 HTML 安全格式，放進 <textarea> 裡面才不會被解析
 */
function escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') {
        return unsafe;
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
