import * as vscode from 'vscode';
import { ManifestManager } from './manifestManager';
import { SmartReplace } from './smartReplace';
import { UndoManager } from './undoManager';
import { HistoryTreeProvider, OperationItem } from './historyTreeProvider';

export function activate(context: vscode.ExtensionContext) {
    const manifestManager = new ManifestManager();
    const smartReplace = new SmartReplace(manifestManager);
    const undoManager = new UndoManager(manifestManager);
    const historyTreeProvider = new HistoryTreeProvider(manifestManager);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('msreplace.historyView', historyTreeProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('msreplace.replaceAll', async () => {
            await smartReplace.run();
            historyTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('msreplace.undo', async (item?: OperationItem) => {
            if (item && item.manifest) {
                await undoManager.run(item.manifest.id);
            } else {
                await undoManager.run();
            }
            historyTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('msreplace.redo', async (item?: OperationItem) => {
            if (item && item.manifest) {
                await undoManager.redo(item.manifest.id);
            } else {
                await undoManager.redo();
            }
            historyTreeProvider.refresh();
        })
    );
}

export function deactivate() {}
