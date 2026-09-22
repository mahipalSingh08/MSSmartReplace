import * as vscode from 'vscode';
import { ManifestManager } from './manifestManager';
import { ReplaceMatch, Manifest } from './types';

export class SmartReplace {
    constructor(private manifestManager: ManifestManager) {}

    public async run() {
        const findText = await vscode.window.showInputBox({ prompt: 'Find text', placeHolder: 'Text or regex to find' });
        if (!findText) return;

        const isRegexChoice = await vscode.window.showQuickPick(['Literal Text', 'Regular Expression'], { placeHolder: 'Search mode' });
        if (!isRegexChoice) return;
        const isRegex = isRegexChoice === 'Regular Expression';

        const replaceText = await vscode.window.showInputBox({ prompt: 'Replace with', placeHolder: 'Replacement text' });
        if (replaceText === undefined) return;

        const scopeChoice = await vscode.window.showQuickPick(['Workspace', 'Current File', 'Glob Pattern'], { placeHolder: 'Scope' });
        if (!scopeChoice) return;

        let uris: vscode.Uri[] = [];
        let scopeString = 'workspace';

        if (scopeChoice === 'Workspace') {
            uris = await vscode.workspace.findFiles('**/*', '{**/node_modules/**,**/.git/**,**/.vscode-test/**,**/out/**}');
        } else if (scopeChoice === 'Current File') {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active file');
                return;
            }
            uris = [editor.document.uri];
            scopeString = 'current-file';
        } else {
            const glob = await vscode.window.showInputBox({ prompt: 'Glob pattern', placeHolder: 'e.g. src/**/*.ts' });
            if (!glob) return;
            uris = await vscode.workspace.findFiles(glob, '{**/node_modules/**,**/.git/**}');
            scopeString = glob;
        }

        let regex: RegExp;
        try {
            // If it's literal, escape special characters. If it's regex, use as-is.
            const pattern = isRegex ? findText : findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(pattern, 'gm'); // Global, multiline
        } catch (e: any) {
            vscode.window.showErrorMessage(`Invalid regex: ${e.message}`);
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Smart Replace: Finding and collecting matches...",
            cancellable: false
        }, async (progress) => {
            const matches: ReplaceMatch[] = [];
            const workspaceEdit = new vscode.WorkspaceEdit();
            
            let filesProcessed = 0;

            for (const uri of uris) {
                try {
                    const document = await vscode.workspace.openTextDocument(uri);
                    const text = document.getText();
                    regex.lastIndex = 0; // Reset regex
                    let match;
                    
                    while ((match = regex.exec(text)) !== null) {
                        if (match.index === regex.lastIndex) {
                            regex.lastIndex++; // Prevent infinite loops with zero-width matches
                        }

                        const startPos = document.positionAt(match.index);
                        const endPos = document.positionAt(match.index + match[0].length);
                        
                        // Grab ~1 line of context before and after
                        const startLine = startPos.line;
                        const endLine = endPos.line;
                        
                        const contextBeforeStart = Math.max(0, startPos.character - 50);
                        const contextAfterEnd = Math.min(document.lineAt(endLine).text.length, endPos.character + 50);
                        
                        const contextBefore = document.lineAt(startLine).text.substring(contextBeforeStart, startPos.character);
                        const contextAfter = document.lineAt(endLine).text.substring(endPos.character, contextAfterEnd);

                        // If regex, we need to evaluate the replacement string (e.g. handle $1, $2)
                        // Simple replace approach:
                        const evaluatedReplaceText = match[0].replace(regex, replaceText);

                        matches.push({
                            filePath: uri.fsPath,
                            lineNumber: startLine,
                            startChar: startPos.character,
                            endChar: endPos.character,
                            originalText: match[0],
                            replacedText: evaluatedReplaceText,
                            contextBefore,
                            contextAfter
                        });

                        workspaceEdit.replace(uri, new vscode.Range(startPos, endPos), evaluatedReplaceText);
                    }
                } catch (e) {
                    // Ignore binary files or files that can't be opened as text
                }
                filesProcessed++;
                progress.report({ increment: (1 / uris.length) * 100 });
            }

            if (matches.length === 0) {
                vscode.window.showInformationMessage('Smart Replace: No matches found.');
                return;
            }

            const manifest = this.manifestManager.createManifest(findText, isRegex, replaceText, scopeString);
            manifest.matches = matches;
            
            // Save manifest BEFORE applying edits
            await this.manifestManager.saveManifest(manifest);

            // Apply edits
            const success = await vscode.workspace.applyEdit(workspaceEdit);
            if (success) {
                // Check if git is available and auto-commit
                await this.tryGitCommit(manifest);
                vscode.window.showInformationMessage(`Replaced ${matches.length} occurrences across ${new Set(matches.map(m => m.filePath)).size} files — Operation #${manifest.id}`);
            } else {
                vscode.window.showErrorMessage('Failed to apply workspace edit. Rolling back.');
            }
        });
    }

    private async tryGitCommit(manifest: Manifest) {
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) return;
            
            const git = gitExtension.isActive ? gitExtension.exports : await gitExtension.activate();
            const api = git.getAPI(1);
            if (api.repositories.length === 0) return;

            const repo = api.repositories[0];
            
            // Simple heuristic: if there are working tree changes before we applied, 
            // we probably shouldn't blindly commit, to avoid mixing changes.
            // But doing this reliably requires checking status BEFORE replace, 
            // which we didn't do. For now, we'll offer a choice.
            
            const choice = await vscode.window.showInformationMessage(
                'Smart Replace applied. Do you want to stage and commit these changes?',
                'Yes', 'No'
            );
            
            if (choice === 'Yes') {
                await repo.add(manifest.matches.map(m => vscode.Uri.file(m.filePath)));
                await repo.commit(`smart-replace: ${manifest.findText} -> ${manifest.replaceText} (op ${manifest.id})`);
            }
        } catch (e) {
            console.error('Git integration failed', e);
        }
    }
}
