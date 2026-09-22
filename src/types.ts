export interface ReplaceMatch {
    filePath: string;
    lineNumber: number; // 0-indexed
    startChar: number;
    endChar: number;
    originalText: string;
    replacedText: string;
    contextBefore: string;
    contextAfter: string;
}

export interface Manifest {
    id: string;
    timestamp: number;
    findText: string;
    isRegex: boolean;
    replaceText: string;
    scope: string; // 'current-file', 'workspace', or glob pattern
    matches: ReplaceMatch[];
    reverted: boolean;
}
