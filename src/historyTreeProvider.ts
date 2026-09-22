import * as vscode from 'vscode';
import * as path from 'path';
import { ManifestManager } from './manifestManager';
import { Manifest } from './types';

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HistoryItem | undefined | void> = new vscode.EventEmitter<HistoryItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<HistoryItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private manifestManager: ManifestManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HistoryItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: HistoryItem): Thenable<HistoryItem[]> {
        if (!element) {
            // Root level: show all operations
            const manifests = this.manifestManager.getManifests();
            return Promise.resolve(manifests.map(m => new OperationItem(m)));
        } else if (element instanceof OperationItem) {
            // Child level: show files affected in this operation
            const matchesByFile = new Map<string, number>();
            for (const match of element.manifest.matches) {
                matchesByFile.set(match.filePath, (matchesByFile.get(match.filePath) || 0) + 1);
            }
            const children = Array.from(matchesByFile.entries()).map(([filePath, count]) => {
                return new FileItem(element.manifest, filePath, count);
            });
            return Promise.resolve(children);
        }
        return Promise.resolve([]);
    }
}

export abstract class HistoryItem extends vscode.TreeItem {}

export class OperationItem extends HistoryItem {
    constructor(public readonly manifest: Manifest) {
        super(
            `${manifest.findText} → ${manifest.replaceText}`,
            vscode.TreeItemCollapsibleState.Collapsed
        );
        this.tooltip = `Replaced ${manifest.matches.length} occurrences in ${new Set(manifest.matches.map(m => m.filePath)).size} files`;
        const date = new Date(manifest.timestamp);
        this.description = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} ${manifest.reverted ? '(Reverted)' : ''}`;
        this.contextValue = 'operation';
        this.iconPath = new vscode.ThemeIcon('history');
    }
}

export class FileItem extends HistoryItem {
    constructor(
        public readonly manifest: Manifest,
        public readonly filePath: string,
        public readonly matchCount: number
    ) {
        super(vscode.Uri.file(filePath), vscode.TreeItemCollapsibleState.None);
        this.description = `${matchCount} matches`;
        this.tooltip = this.filePath;
        this.contextValue = 'file';
        this.iconPath = vscode.ThemeIcon.File;

        // Command to open the file
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(filePath)]
        };
    }
}
