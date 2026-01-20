/**
 * Outbound Port: File System Port
 *
 * Defines how the core domain interacts with the file system.
 * Abstracts away VS Code's workspace.fs, Node's fs, or any other implementation.
 */

/**
 * Represents a file or directory.
 */
export interface FileStat {
    type: 'file' | 'directory' | 'symlink';
    size: number;
    createdAt: Date;
    modifiedAt: Date;
}

/**
 * Directory entry.
 */
export interface DirectoryEntry {
    name: string;
    type: 'file' | 'directory';
}

/**
 * IFileSystemPort defines the contract for file system operations.
 */
export interface IFileSystemPort {
    // ═══════════════════════════════════════════════════════════════════════════
    // Read Operations
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Read a file's content as UTF-8 string.
     */
    readFile(path: string): Promise<string>;

    /**
     * Read a file's content as raw bytes.
     */
    readFileRaw(path: string): Promise<Uint8Array>;

    /**
     * Get file/directory stats.
     */
    stat(path: string): Promise<FileStat>;

    /**
     * Check if a path exists.
     */
    exists(path: string): Promise<boolean>;

    /**
     * List directory contents.
     */
    readDirectory(path: string): Promise<DirectoryEntry[]>;

    // ═══════════════════════════════════════════════════════════════════════════
    // Write Operations
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Write content to a file (creates if not exists).
     */
    writeFile(path: string, content: string): Promise<void>;

    /**
     * Create a directory (and parents if needed).
     */
    createDirectory(path: string): Promise<void>;

    /**
     * Delete a file or directory.
     */
    delete(path: string, options?: { recursive?: boolean }): Promise<void>;

    /**
     * Rename/move a file or directory.
     */
    rename(oldPath: string, newPath: string): Promise<void>;

    // ═══════════════════════════════════════════════════════════════════════════
    // Workspace
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get the root workspace folder path.
     */
    getWorkspaceRoot(): string | undefined;

    /**
     * Find files matching a glob pattern.
     */
    findFiles(pattern: string, exclude?: string): Promise<string[]>;

    // ═══════════════════════════════════════════════════════════════════════════
    // Watching
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Watch for file changes.
     * Returns a disposable to stop watching.
     */
    watch(
        pattern: string,
        callback: (event: FileChangeEvent) => void
    ): Disposable;
}

export interface FileChangeEvent {
    type: 'created' | 'changed' | 'deleted';
    path: string;
}

export interface Disposable {
    dispose(): void;
}
