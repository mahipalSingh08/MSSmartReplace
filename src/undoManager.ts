import * as vscode from 'vscode';
import { ManifestManager } from './manifestManager';
import { Manifest } from './types';

export class UndoManager {
    constructor(private manifestManager: ManifestManager) {}

    public async run(manifestId?: string) {
        let manifest: Manifest | undefined;

        if (manifestId) {
            manifest = this.manifestManager.getManifest(manifestId);
        } else {
            const manifests = this.manifestManager.getManifests().filter(m => !m.reverted);
            if (manifests.length === 0) {
                vscode.window.showInformationMessage('No active Smart Replace operations to undo.');
                return;
            }

            const items = manifests.map(m => {
                const date = new Date(m.timestamp);
                return {
                    label: `${m.findText} → ${m.replaceText}`,
                    description: `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
                    detail: `${m.matches.length} matches in scope: ${m.scope}`,
                    manifest: m
                };
            });

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select an operation to undo'
            });

            if (!selected) return;
            manifest = selected.manifest;
        }

        if (!manifest) {
            vscode.window.showErrorMessage('Manifest not found.');
            return;
        }

        if (manifest.reverted) {
            vscode.window.showWarningMessage('This operation has already been reverted.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Smart Replace: Undoing operation...",
            cancellable: false
        }, async (progress) => {
            const workspaceEdit = new vscode.WorkspaceEdit();
            let skippedLocations = 0;
            let appliedLocations = 0;

            // Group matches by file for efficiency
            const matchesByFile = new Map<string, typeof manifest.matches>();
            for (const match of manifest.matches) {
                if (!matchesByFile.has(match.filePath)) {
                    matchesByFile.set(match.filePath, []);
                }
                matchesByFile.get(match.filePath)!.push(match);
            }

            for (const [filePath, fileMatches] of matchesByFile.entries()) {
                try {
                    const uri = vscode.Uri.file(filePath);
                    const document = await vscode.workspace.openTextDocument(uri);
                    
                    // Note: When multiple replacements happen on the same line, modifying earlier ones shifts indices.
                    // However, we're building a WorkspaceEdit, which handles shifting for us if we provide the exact ranges 
                    // from the document's CURRENT state. 
                    // Wait, the saved positions (startChar/endChar) were from BEFORE the replacement.
                    // Since the replacement changed string lengths, the current document no longer matches startChar/endChar.
                    // We must find the new location of the replaced text. 
                    // This is where drift detection and context comes in.
                    
                    // To do this robustly per line:
                    const lines = document.getText().split(/\r?\n/);

                    for (const match of fileMatches) {
                        const lineText = lines[match.lineNumber];
                        
                        // We expect the line to contain: contextBefore + replacedText + contextAfter
                        // But it might have shifted left/right due to other edits on the same line.
                        const expectedSnippet = match.contextBefore + match.replacedText + match.contextAfter;
                        
                        if (lineText && lineText.includes(expectedSnippet)) {
                            // Find where the snippet starts in the current line
                            const snippetIdx = lineText.indexOf(expectedSnippet);
                            // Calculate the exact start and end of the replacedText within that snippet
                            const currentStartChar = snippetIdx + match.contextBefore.length;
                            const currentEndChar = currentStartChar + match.replacedText.length;
                            
                            const startPos = new vscode.Position(match.lineNumber, currentStartChar);
                            const endPos = new vscode.Position(match.lineNumber, currentEndChar);
                            
                            workspaceEdit.replace(uri, new vscode.Range(startPos, endPos), match.originalText);
                            appliedLocations++;
                        } else {
                            skippedLocations++;
                        }
                    }
                } catch (e) {
                    skippedLocations += fileMatches.length;
                }
                
                progress.report({ increment: (1 / matchesByFile.size) * 100 });
            }

            const success = await vscode.workspace.applyEdit(workspaceEdit);
            if (success) {
                manifest.reverted = true;
                await this.manifestManager.saveManifest(manifest);
                
                let msg = `Successfully reverted ${appliedLocations} locations.`;
                if (skippedLocations > 0) {
                    msg += ` ${skippedLocations} locations skipped due to drift — please review manually.`;
                    vscode.window.showWarningMessage(msg);
                } else {
                    vscode.window.showInformationMessage(msg);
                }
            } else {
                vscode.window.showErrorMessage('Failed to apply reversion edits.');
            }
        });
    }
}
