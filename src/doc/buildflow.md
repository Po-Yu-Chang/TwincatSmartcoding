# TwinCAT 編輯器擴充功能建構流程

本文檔記錄了建立 TwinCAT VS Code 編輯器擴充功能的步驟和關鍵設定。

## 1. 專案初始化

使用 `yo code` (Yeoman VS Code Extension Generator) 初始化專案：

*   **目標目錄**: `c:\\Users\\qoose\\Desktop\\文件資料\\學習文件\\[C]-ChatGPT\\VscodeExtension`
*   **執行指令** (在目標目錄的上一層或指定路徑執行):
    ```powershell
    Set-Location -LiteralPath "c:\\Users\\qoose\\Desktop\\文件資料\\學習文件\\[C]-ChatGPT\\VscodeExtension"
    npx --package yo --package generator-code -- yo code . --skipOpen --extensionType ts --extensionDisplayName "TwinCAT Editor" --extensionId "twincat-editor" --extensionDescription "A VS Code extension for editing TwinCAT files (.tcdut, .tcgvl, .tcpou) with split view for declarations and code." --pkgManager npm --bundler webpack --gitInit true
    ```
*   **選項**:
    *   語言: TypeScript
    *   套件管理員: npm
    *   建構工具: webpack
    *   其他選項依提示選擇 (例如，啟用 Git 初始化)。

這會產生基本的專案結構，包含 `package.json`, `tsconfig.json`, `webpack.config.js`, `src/extension.ts` 等檔案。

## 2. `package.json` 設定

`package.json` 是擴充功能的核心設定檔，主要修改和設定如下：

*   **`name`**: `twincat-editor`
*   **`displayName`**: `TwinCAT Editor`
*   **`description`**: 擴充功能的描述。
*   **`version`**: 版本號 (例如 `0.0.1`)。
*   **`engines.vscode`**: 指定相容的 VS Code 版本 (例如 `^1.100.0`)。
*   **`activationEvents`**: 定義擴充功能的啟用時機。
    ```json
    "activationEvents": [
      "onCommand:twincat-editor.openEditor",
      "onLanguage:tcdut",
      "onLanguage:tcgvl",
      "onLanguage:tcpou"
    ],
    ```
    *   `onCommand:twincat-editor.openEditor`: 當執行特定指令時啟用。
    *   `onLanguage:*`: 當開啟特定語言的檔案時啟用 (也可能由 `customEditors` 自動處理)。
*   **`main`**: 指向編譯後的擴充功能進入點 JavaScript 檔案。
    ```json
    "main": "./dist/extension.js",
    ```
*   **`contributes`**: 擴充功能的貢獻點。
    *   **`commands`**: 註冊可供使用者執行的指令。
        ```json
        "commands": [
          {
            "command": "twincat-editor.openEditor",
            "title": "Open TwinCAT Editor"
          }
        ],
        ```
    *   **`customEditors`**: 定義自訂編輯器。
        ```json
        "customEditors": [
          {
            "viewType": "twincat.editor",
            "displayName": "TwinCAT Editor",
            "selector": [
              { "filenamePattern": "*.tcdut" },
              { "filenamePattern": "*.tcgvl" },
              { "filenamePattern": "*.tcpou" }
            ],
            "priority": "default"
          }
        ],
        ```
        *   `viewType`: 自訂編輯器的唯一識別碼。
        *   `displayName`: 顯示名稱。
        *   `selector`: 指定此編輯器適用的檔案類型。
    *   **`languages`**: 定義支援的語言。
        ```json
        "languages": [
          {
            "id": "tcdut",
            "aliases": ["TwinCAT DUT", "tcdut"],
            "extensions": [".tcdut", ".TCDUT"],
            "configuration": "./language-configuration.json"
          },
          {
            "id": "tcgvl",
            "aliases": ["TwinCAT GVL", "tcgvl"],
            "extensions": [".tcgvl", ".TCGVL"],
            "configuration": "./language-configuration.json"
          },
          {
            "id": "tcpou",
            "aliases": ["TwinCAT POU", "tcpou"],
            "extensions": [".tcpou", ".TCPOU"],
            "configuration": "./language-configuration.json"
          }
        ],
        ```
        *   `id`: 語言的唯一識別碼。
        *   `aliases`: 語言的別名。
        *   `extensions`: 該語言對應的副檔名 (建議包含大小寫以增強相容性)。
        *   `configuration`: 指向語言設定檔 (用於語法突顯、註解等)。
*   **`scripts`**: 定義常用的 npm 指令。
    ```json
    "scripts": {
      "vscode:prepublish": "npm run package",
      "compile": "webpack",
      "watch": "webpack --watch",
      "package": "webpack --mode production --devtool hidden-source-map",
      // ... 其他測試和 lint 指令
    },
    ```
*   **`devDependencies`**: 開發時相依的套件，例如：
    *   `@types/vscode`: VS Code API 的 TypeScript 型別定義。
    *   `typescript`: TypeScript 編譯器。
    *   `webpack`, `webpack-cli`, `ts-loader`: 用於打包 TypeScript 程式碼。
    *   `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`: 用於程式碼風格檢查。

## 3. 語言設定檔 (`language-configuration.json`)

建立 `language-configuration.json` 檔案於專案根目錄，用於定義基本的語言特性，例如註解符號和括號配對。

```json
{
  "comments": {
    "lineComment": "//",
    "blockComment": ["(*", "*)"]
  },
  "brackets": [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
    ["VAR", "END_VAR"],
    ["TYPE", "END_TYPE"],
    ["PROGRAM", "END_PROGRAM"],
    ["FUNCTION_BLOCK", "END_FUNCTION_BLOCK"],
    ["FUNCTION", "END_FUNCTION"],
    ["STRUCT", "END_STRUCT"],
    ["VAR_GLOBAL", "END_VAR"]
  ],
  "autoClosingPairs": [
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" },
    { "open": "(", "close": ")" },
    { "open": "'", "close": "'", "notIn": ["string", "comment"] },
    { "open": "\"", "close": "\"", "notIn": ["string"] },
    { "open": "(*", "close": "*)" }
  ],
  "surroundingPairs": [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
    ["'", "'"],
    ["\"", "\""],
    ["(*", "*)"]
  ]
}
```

## 4. 擴充功能進入點 (`src/extension.ts`)

`src/extension.ts` 是擴充功能的主要程式碼檔案。

```typescript
import * as vscode from 'vscode';
import { TcEditorProvider } from './tcEditorProvider'; // 匯入自訂編輯器提供者

export function activate(context: vscode.ExtensionContext) {
    // 註冊自訂編輯器提供者
    context.subscriptions.push(TcEditorProvider.register(context));

    // 註冊指令 (如果需要手動開啟編輯器)
    context.subscriptions.push(vscode.commands.registerCommand('twincat-editor.openEditor', () => {
        // 邏輯：開啟一個新的 TwinCAT 檔案或提示使用者選擇檔案
        // 或者，此指令可以與 customEditors 的 viewType 結合使用
        // vscode.window.showInformationMessage('TwinCAT Editor command invoked!');
    }));
}

export function deactivate() {
    // 擴充功能停用時的清理工作
}
```

*   **`activate` 函式**:
    *   當擴充功能被啟用時呼叫。
    *   使用 `vscode.window.registerCustomEditorProvider` (或透過靜態註冊方法如 `TcEditorProvider.register(context)`) 來註冊自訂編輯器 `TcEditorProvider`。
    *   註冊 `twincat-editor.openEditor` 指令。
*   **`deactivate` 函式**:
    *   當擴充功能被停用時呼叫，用於釋放資源。

## 5. 自訂編輯器提供者 (`src/tcEditorProvider.ts`)

`src/tcEditorProvider.ts` 實作了 `vscode.CustomTextEditorProvider` 介面，負責管理自訂編輯器的生命週期和行為。

```typescript
// 簡化版結構，詳細實作參考專案檔案
import * as vscode from 'vscode';

interface ParsedTcDocument {
    prefix: string;
    declarations: string;
    declarationBlockEndMarker: string;
    code: string;
    suffix: string;
}

export class TcEditorProvider implements vscode.CustomTextEditorProvider {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new TcEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(TcEditorProvider.viewType, provider, {
            webviewOptions: {
                retainContextWhenHidden: true, // 保持 Webview 在背景時的狀態
            },
            supportsMultipleEditorsPerDocument: false,
        });
    }

    private static readonly viewType = 'twincat.editor';

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // 設定 Webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

        // 檔案解析與傳遞給 Webview
        const updateWebview = () => {
            const parsedDoc = this.parseDocument(document.getText());
            webviewPanel.webview.postMessage({
                type: 'update',
                text: parsedDoc, // 傳遞整個解析後的物件
            });
        };

        // 監聽來自 Webview 的訊息 (例如內容變更)
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'contentChanged':
                    this.updateTextDocument(document, e.payload);
                    return;
                // 可以有 'save' 等其他訊息類型
            }
        });

        // 監聽文件變更 (例如外部修改)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        updateWebview(); // 初始載入
    }

    private parseDocument(text: string): ParsedTcDocument {
        // ... 實作解析邏輯 (使用正則表達式等) ...
        // 返回 ParsedTcDocument 物件
        // 範例 (簡化):
        const upperText = text.toUpperCase();
        let declarations = "";
        let code = "";
        let prefix = "";
        let suffix = "";
        let declarationBlockEndMarker = "END_VAR"; // 預設

        const varStartRegex = /(VAR\s*|VAR_GLOBAL\s*|VAR_INPUT\s*|VAR_OUTPUT\s*|VAR_IN_OUT\s*)/i;
        const endVarRegex = /END_VAR/i;
        const typeStartRegex = /TYPE\s+([\w\s.:]+)\s*:\s*STRUCT/i;
        const endTypeRegex = /END_STRUCT\s*;\s*END_TYPE/i;
        const pouStartRegex = /(PROGRAM|FUNCTION_BLOCK|FUNCTION)\s+([\w]+)/i;
        const pouEndRegex = /(END_PROGRAM|END_FUNCTION_BLOCK|END_FUNCTION)/i;

        let declStartIndex = -1;
        let declEndIndex = -1;
        let codeStartIndex = -1;
        let codeEndIndex = -1;

        // 嘗試 POU 結構
        let match = pouStartRegex.exec(text);
        if (match) {
            prefix = text.substring(0, match.index + match[0].length);
            const remainingTextAfterPouHeader = text.substring(prefix.length);
            
            const varMatch = varStartRegex.exec(remainingTextAfterPouHeader);
            if (varMatch) {
                declStartIndex = varMatch.index;
                prefix += remainingTextAfterPouHeader.substring(0, declStartIndex); // 將 POU 頭部到 VAR 之間的內容也視為 prefix
                
                const endVarMatch = endVarRegex.exec(remainingTextAfterPouHeader.substring(declStartIndex));
                if (endVarMatch) {
                    declEndIndex = declStartIndex + endVarMatch.index + endVarMatch[0].length;
                    declarations = remainingTextAfterPouHeader.substring(declStartIndex, declEndIndex);
                    declarationBlockEndMarker = endVarMatch[0];
                    codeStartIndex = declEndIndex;
                } else { // 只有 VAR 沒有 END_VAR
                    declarations = remainingTextAfterPouHeader.substring(declStartIndex);
                    codeStartIndex = declStartIndex + declarations.length;
                }
            } else { // 沒有 VAR 區塊
                codeStartIndex = 0; // 程式碼從 POU 頭部後開始
            }

            const pouEndMatch = pouEndRegex.exec(remainingTextAfterPouHeader.substring(codeStartIndex));
            if (pouEndMatch) {
                codeEndIndex = codeStartIndex + pouEndMatch.index;
                code = remainingTextAfterPouHeader.substring(codeStartIndex, codeEndIndex);
                suffix = remainingTextAfterPouHeader.substring(codeEndIndex);
            } else {
                code = remainingTextAfterPouHeader.substring(codeStartIndex);
                suffix = "";
            }
        } else {
             // 嘗試 TYPE (DUT) 結構
            match = typeStartRegex.exec(text);
            if (match) {
                declStartIndex = match.index;
                prefix = text.substring(0, declStartIndex);
                const endTypeMatch = endTypeRegex.exec(text.substring(declStartIndex));
                if (endTypeMatch) {
                    declEndIndex = declStartIndex + endTypeMatch.index + endTypeMatch[0].length;
                    declarations = text.substring(declStartIndex, declEndIndex);
                    declarationBlockEndMarker = "END_STRUCT; END_TYPE"; // 特定標記
                    suffix = text.substring(declEndIndex);
                } else {
                    declarations = text.substring(declStartIndex);
                    suffix = "";
                }
                code = ""; // DUT 通常沒有實作程式碼區
            } else {
                // 嘗試 VAR_GLOBAL (GVL) 結構
                match = varStartRegex.exec(text); // 假設 GVL 以 VAR_GLOBAL 開頭
                 if (match && match[0].toUpperCase().startsWith("VAR_GLOBAL")) {
                    declStartIndex = match.index;
                    prefix = text.substring(0, declStartIndex);
                    const endVarMatch = endVarRegex.exec(text.substring(declStartIndex));
                    if (endVarMatch) {
                        declEndIndex = declStartIndex + endVarMatch.index + endVarMatch[0].length;
                        declarations = text.substring(declStartIndex, declEndIndex);
                        declarationBlockEndMarker = endVarMatch[0];
                        suffix = text.substring(declEndIndex);
                    } else {
                        declarations = text.substring(declStartIndex);
                        suffix = "";
                    }
                    code = ""; // GVL 通常沒有實作程式碼區
                } else {
                    // 無法識別結構，將全部視為程式碼或宣告 (根據檔案類型判斷，或提供預設行為)
                    // 這裡簡化處理：如果沒有明顯的宣告區，則都視為 code
                    // 實際應用中可能需要更細緻的判斷
                    if (document.fileName.toLowerCase().endsWith(".tcdut") || document.fileName.toLowerCase().endsWith(".tcgvl")) {
                        declarations = text;
                    } else {
                        code = text;
                    }
                }
            }
        }
        
        return { prefix, declarations, declarationBlockEndMarker, code, suffix };
    }

    private reconstructFileContent(parsedDoc: ParsedTcDocument): string {
        // ... 根據 ParsedTcDocument 重建檔案內容 ...
        return `${parsedDoc.prefix}${parsedDoc.declarations}${parsedDoc.code}${parsedDoc.suffix}`;
    }

    private updateTextDocument(document: vscode.TextDocument, newContent: ParsedTcDocument) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0), // 替換整個文件內容
            this.reconstructFileContent(newContent)
        );
        vscode.workspace.applyEdit(edit);
    }

    private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css'));
        const nonce = getNonce(); // 用於 CSP

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-T">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <link href="${styleUri}" rel="stylesheet">
                <title>TwinCAT Editor</title>
            </head>
            <body>
                <div class="container">
                    <div class="editor-pane">
                        <h3>Declarations</h3>
                        <textarea id="declarations-editor" class="editor-area"></textarea>
                    </div>
                    <div class="editor-pane">
                        <h3>Code</h3>
                        <textarea id="code-editor" class="editor-area"></textarea>
                    </div>
                </div>
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const declarationsEditor = document.getElementById('declarations-editor');
                    const codeEditor = document.getElementById('code-editor');
                    let currentPrefix = "";
                    let currentDeclarationBlockEndMarker = "END_VAR";
                    let currentSuffix = "";

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'update':
                                currentPrefix = message.text.prefix;
                                declarationsEditor.value = message.text.declarations;
                                currentDeclarationBlockEndMarker = message.text.declarationBlockEndMarker;
                                codeEditor.value = message.text.code;
                                currentSuffix = message.text.suffix;
                                break;
                        }
                    });

                    function sendChanges() {
                        vscode.postMessage({
                            type: 'contentChanged',
                            payload: {
                                prefix: currentPrefix,
                                declarations: declarationsEditor.value,
                                declarationBlockEndMarker: currentDeclarationBlockEndMarker,
                                code: codeEditor.value,
                                suffix: currentSuffix
                            }
                        });
                    }

                    declarationsEditor.addEventListener('input', sendChanges);
                    codeEditor.addEventListener('input', sendChanges);
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
```

*   **`resolveCustomTextEditor` 方法**:
    *   當使用者開啟一個符合 `selector` 的檔案時被呼叫。
    *   設定 `WebviewPanel` 的 HTML 內容 (`webviewPanel.webview.html`)。
    *   **檔案解析**: 呼叫 `parseDocument` 方法讀取並解析 `TextDocument` 的內容，將其分割為宣告區和程式碼區 (以及前後綴、結束標記)。
    *   **Webview 通訊**:
        *   使用 `webview.postMessage()` 將解析後的內容傳遞給 Webview。
        *   使用 `webview.onDidReceiveMessage()` 接收來自 Webview 的訊息 (例如，當 Webview 中的內容被修改時)。
        *   當收到內容變更的訊息時，呼叫 `updateTextDocument` 方法，該方法會建立一個 `WorkspaceEdit` 來更新原始的 `TextDocument`，並使用 `vscode.workspace.applyEdit()` 套用變更。
    *   **文件變更監聽**: 監聽 `vscode.workspace.onDidChangeTextDocument` 事件，如果當前文件在外部被修改，則重新解析並更新 Webview。
*   **`parseDocument` 方法**:
    *   接收文件內容字串。
    *   使用正則表達式或字串操作來識別宣告區塊 (例如 `VAR...END_VAR`, `TYPE...END_TYPE`, `VAR_GLOBAL...END_VAR`) 和程式碼區塊。
    *   返回一個包含 `prefix`, `declarations`, `declarationBlockEndMarker`, `code`, `suffix` 的物件。
*   **`reconstructFileContent` 方法**:
    *   接收 `ParsedTcDocument` 物件。
    *   將各部分重新組合成完整的檔案內容字串。
*   **`getHtmlForWebview` 方法**:
    *   產生 Webview 的 HTML 結構。
    *   包含兩個 `<textarea>` (一個用於宣告，一個用於程式碼)。
    *   包含一個 `<script>` 區塊，用於：
        *   使用 `acquireVsCodeApi()` 獲取與擴充功能通訊的 API。
        *   監聽來自擴充功能的 `message` 事件，以接收初始資料並填充 `textarea`。
        *   監聽 `textarea` 的 `input` 事件，當內容變更時，使用 `vscode.postMessage()` 將更新後的內容 (包含所有解析部分) 傳回給擴充功能。
    *   引入 CSS 檔案 (`media/style.css`) 和 JavaScript 檔案 (`media/main.js` - 如果將腳本分離出去)。
    *   設定 `Content-Security-Policy` (CSP) 以增強安全性。

## 6. Webview 資源

*   **`media/style.css`**: 建立此檔案以定義 Webview 的樣式。
    ```css
    /* media/style.css */
    body, html {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden; /* Prevent scrollbars on body */
        font-family: var(--vscode-font-family);
        color: var(--vscode-editor-foreground);
        background-color: var(--vscode-editor-background);
    }

    .container {
        display: flex;
        flex-direction: column; /* Stack panes vertically */
        height: 100vh; /* Full viewport height */
        padding: 10px;
        box-sizing: border-box;
    }

    .editor-pane {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px; /* Space between panes */
        min-height: 100px; /* Minimum height for panes */
    }

    .editor-pane:last-child {
        margin-bottom: 0;
    }

    .editor-pane h3 {
        margin-top: 0;
        margin-bottom: 5px;
        font-size: var(--vscode-font-size);
    }

    .editor-area {
        width: 100%;
        flex-grow: 1; /* Allow textareas to grow and fill available space */
        border: 1px solid var(--vscode-input-border, #ccc);
        font-family: var(--vscode-editor-font-family);
        font-size: var(--vscode-editor-font-size);
        line-height: var(--vscode-editor-line-height);
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        box-sizing: border-box;
        resize: none; /* Disable manual resizing by user if not desired */
        min-height: 150px; /* Ensure a minimum visible area */
    }
    ```
*   **`media/main.js`** (可選，如果將 Webview 腳本從 HTML 中分離出來):
    ```javascript
    // media/main.js (範例，目前腳本內嵌在 getHtmlForWebview 中)
    // const vscode = acquireVsCodeApi();
    // ... (將 getHtmlForWebview 中的 <script> 內容移到此處)
    ```

## 7. 建構與執行

*   **編譯**:
    ```bash
    npm run compile
    ```
    或在開發時使用監看模式：
    ```bash
    npm run watch
    ```
    這會使用 `webpack` 將 `src` 目錄下的 TypeScript 程式碼編譯並打包到 `dist/extension.js`。
*   **執行與偵錯**:
    *   在 VS Code 中按下 `F5`。
    *   這會啟動一個新的 "擴充功能開發主機" (Extension Development Host) 視窗，並在其中載入您的擴充功能。
    *   在此視窗中開啟或建立 `.tcdut`, `.tcgvl`, `.tcpou` 檔案以測試自訂編輯器。

## 8. `webpack.config.js` 和 `tsconfig.json`

這些檔案由 `yo code` 產生，通常不需要大幅修改即可開始。

*   **`webpack.config.js`**: 設定 webpack 如何打包模組。
    *   `target`: `node` (因為是 VS Code 擴充功能)。
    *   `entry`: `src/extension.ts`。
    *   `output`: `dist` 目錄，檔名為 `extension.js`。
    *   `resolve.extensions`: 解析 `.ts` 和 `.js` 檔案。
    *   `module.rules`: 使用 `ts-loader` 處理 TypeScript 檔案。
*   **`tsconfig.json`**: TypeScript 編譯器設定。
    *   `module`: `commonjs`。
    *   `target`: ES 版本 (例如 `es6`)。
    *   `outDir`: 輸出目錄 (通常由 webpack 控制，但可設定)。
    *   `rootDir`: `src`。
    *   `strict`: 啟用所有嚴格型別檢查選項。

---

這份文件概述了 TwinCAT 編輯器擴充功能的建構流程和關鍵組件。隨著開發的進行，可以進一步細化和補充。
