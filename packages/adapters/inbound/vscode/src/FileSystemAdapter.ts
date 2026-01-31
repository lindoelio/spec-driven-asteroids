/**
 * VS Code File System Adapter
 *
 * Implements IFileSystemPort using VS Code's workspace.fs API.
 */

import * as vscode from 'vscode';
import type {
    IFileSystemPort,
    FileStat,
    DirectoryEntry,
    FileChangeEvent,
    Disposable,
    FileTree,
    FileNode,
} from '@spec-driven/core';

export class VsCodeFileSystemAdapter implements IFileSystemPort {
    // ═══════════════════════════════════════════════════════════════════════════
    // Read Operations
    // ═══════════════════════════════════════════════════════════════════════════

    async readFile(path: string): Promise<string> {
        const uri = this.toUri(path);
        const content = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(content);
    }

    async readFileRaw(path: string): Promise<Uint8Array> {
        const uri = this.toUri(path);
        return vscode.workspace.fs.readFile(uri);
    }

    async stat(path: string): Promise<FileStat> {
        const uri = this.toUri(path);
        const stat = await vscode.workspace.fs.stat(uri);
        return {
            type: stat.type === vscode.FileType.Directory ? 'directory' :
                stat.type === vscode.FileType.SymbolicLink ? 'symlink' : 'file',
            size: stat.size,
            createdAt: new Date(stat.ctime),
            modifiedAt: new Date(stat.mtime),
        };
    }

    async exists(path: string): Promise<boolean> {
        try {
            await this.stat(path);
            return true;
        } catch {
            return false;
        }
    }

    async readDirectory(path: string): Promise<DirectoryEntry[]> {
        const uri = this.toUri(path);
        const entries = await vscode.workspace.fs.readDirectory(uri);
        return entries.map(([name, type]) => ({
            name,
            type: type === vscode.FileType.Directory ? 'directory' : 'file',
        }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Write Operations
    // ═══════════════════════════════════════════════════════════════════════════

    async writeFile(path: string, content: string): Promise<void> {
        const uri = this.toUri(path);
        const encoded = new TextEncoder().encode(content);
        await vscode.workspace.fs.writeFile(uri, encoded);
    }

    async createDirectory(path: string): Promise<void> {
        const uri = this.toUri(path);
        await vscode.workspace.fs.createDirectory(uri);
    }

    async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
        const uri = this.toUri(path);
        await vscode.workspace.fs.delete(uri, { recursive: options?.recursive ?? false });
    }

    async rename(oldPath: string, newPath: string): Promise<void> {
        const oldUri = this.toUri(oldPath);
        const newUri = this.toUri(newPath);
        await vscode.workspace.fs.rename(oldUri, newUri);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Workspace
    // ═══════════════════════════════════════════════════════════════════════════

    getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    async findFiles(pattern: string, exclude?: string): Promise<string[]> {
        const uris = await vscode.workspace.findFiles(pattern, exclude);
        return uris.map(uri => uri.fsPath);
    }

    async listFilesRecursive(maxDepth: number = 10): Promise<FileTree> {
        const root = this.getWorkspaceRoot();
        if (!root) {
            return { nodes: [], totalFiles: 0, maxDepth: 0 };
        }

        const nodes: FileNode[] = [];
        let totalFiles = 0;

        const traverse = async (dirPath: string, currentDepth: number): Promise<void> => {
            if (currentDepth > maxDepth) return;

            try {
                const entries = await this.readDirectory(dirPath);

                for (const entry of entries) {
                    const relativePath = dirPath === root
                        ? entry.name
                        : `${dirPath.substring(root.length + 1)}/${entry.name}`;
                    const fullPath = `${dirPath}/${entry.name}`;

                    // Skip common directories that shouldn't be analyzed
                    if (entry.type === 'directory') {
                        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache'];
                        if (skipDirs.includes(entry.name)) continue;
                    }

                    const extension = entry.type === 'file'
                        ? entry.name.split('.').pop() ?? ''
                        : '';

                    let size = 0;
                    if (entry.type === 'file') {
                        try {
                            const stat = await this.stat(fullPath);
                            size = stat.size;
                        } catch {
                            // Skip files we can't stat
                            continue;
                        }
                        totalFiles++;
                    }

                    nodes.push({
                        path: relativePath,
                        type: entry.type,
                        size,
                        extension,
                    });

                    if (entry.type === 'directory') {
                        await traverse(fullPath, currentDepth + 1);
                    }
                }
            } catch {
                // Skip directories we can't read
            }
        };

        await traverse(root, 0);

        return {
            nodes,
            totalFiles,
            maxDepth,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Watching
    // ═══════════════════════════════════════════════════════════════════════════

    watch(pattern: string, callback: (event: FileChangeEvent) => void): Disposable {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        const created = watcher.onDidCreate(uri => {
            callback({ type: 'created', path: uri.fsPath });
        });
        const changed = watcher.onDidChange(uri => {
            callback({ type: 'changed', path: uri.fsPath });
        });
        const deleted = watcher.onDidDelete(uri => {
            callback({ type: 'deleted', path: uri.fsPath });
        });

        return {
            dispose: () => {
                created.dispose();
                changed.dispose();
                deleted.dispose();
                watcher.dispose();
            },
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    private toUri(path: string): vscode.Uri {
        const root = this.getWorkspaceRoot();
        if (!root) {
            throw new Error('No workspace folder is open. Please open a folder before using SpecDriven.');
        }
        // Always resolve relative paths against workspace root
        if (!path.startsWith('/')) {
            return vscode.Uri.file(`${root}/${path}`);
        }
        return vscode.Uri.file(path);
    }
}
