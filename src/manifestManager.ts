import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Manifest } from './types';
import * as crypto from 'crypto';

export class ManifestManager {
    private getHistoryDir(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder open');
        }
        const dir = path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'smart-replace-history');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    public async saveManifest(manifest: Manifest): Promise<void> {
        const dir = this.getHistoryDir();
        const filePath = path.join(dir, `${manifest.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf8');
    }

    public getManifests(): Manifest[] {
        try {
            const dir = this.getHistoryDir();
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
            const manifests = files.map(file => {
                const content = fs.readFileSync(path.join(dir, file), 'utf8');
                return JSON.parse(content) as Manifest;
            });
            // Sort by timestamp descending (newest first)
            return manifests.sort((a, b) => b.timestamp - a.timestamp);
        } catch (e) {
            return [];
        }
    }

    public getManifest(id: string): Manifest | undefined {
        try {
            const dir = this.getHistoryDir();
            const filePath = path.join(dir, `${id}.json`);
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Manifest;
            }
        } catch (e) {
            console.error(e);
        }
        return undefined;
    }

    public createManifest(findText: string, isRegex: boolean, replaceText: string, scope: string): Manifest {
        return {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            findText,
            isRegex,
            replaceText,
            scope,
            matches: [],
            reverted: false
        };
    }
}
