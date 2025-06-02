// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TcEditorProvider } from './tcEditorProvider'; // We will create this file next

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "twincat-editor" is now active!');

	// Register the command to open the custom editor manually
	const commandRegistration = vscode.commands.registerCommand('twincat-editor.openEditor', () => {
		// This command can be used to manually open a file with the custom editor
		// For now, it can simply show an info message or be left empty if
		// auto-opening via file type is the primary mechanism.
		vscode.window.showInformationMessage('TwinCAT Editor: Manual open command invoked.');
		// Potentially, you could add logic here to prompt the user for a file
		// and then open it with the custom editor, but this is often handled by
		// VS Code's default file opening mechanisms when a custom editor is registered.
	});

	context.subscriptions.push(commandRegistration);

	// Register the CustomTextEditorProvider
	const provider = new TcEditorProvider(context);
	const providerRegistration = vscode.window.registerCustomEditorProvider(
		TcEditorProvider.viewType, // This static property will be defined in TcEditorProvider
		provider,
		{
			// For this demo, we enable webview-based editors to be retained when they are hidden
			// (i.e. when the user switches to another tab). This saves the state of the webview
			// but incurs memory overhead.
			webviewOptions: {
				retainContextWhenHidden: true,
			},
			supportsMultipleEditorsPerDocument: false, // Or true if you want to allow it
		}
	);

	context.subscriptions.push(providerRegistration);

	console.log('TwinCAT Editor provider registered.');
}

// This method is called when your extension is deactivated
export function deactivate() {}
