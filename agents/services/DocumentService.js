/**
 * MONOLITH OS - Document Service
 * Manages document operations on Google Drive mounted file system
 *
 * Features:
 * - File listing and search
 * - Document categorization and filing
 * - Index management
 * - Metadata tracking
 */

import fs from 'fs/promises';
import path from 'path';

const DEFAULT_ROOT = '/mnt/h/My Drive/MONOLITH_OS';

const FOLDER_MAPPING = {
  executive: '01_EXECUTIVE',
  exec: '01_EXECUTIVE',
  ceo: '01_EXECUTIVE',
  finance: '02_FINANCE',
  fin: '02_FINANCE',
  cfo: '02_FINANCE',
  technology: '03_TECHNOLOGY',
  tech: '03_TECHNOLOGY',
  cto: '03_TECHNOLOGY',
  legal: '04_LEGAL',
  clo: '04_LEGAL',
  operations: '05_OPERATIONS',
  ops: '05_OPERATIONS',
  coo: '05_OPERATIONS',
  product: '06_PRODUCT',
  prod: '06_PRODUCT',
  cpo: '06_PRODUCT',
  people: '07_PEOPLE',
  hr: '07_PEOPLE',
  chro: '07_PEOPLE',
  marketing: '08_MARKETING',
  mkt: '08_MARKETING',
  cmo: '08_MARKETING',
  security: '09_SECURITY',
  sec: '09_SECURITY',
  ciso: '09_SECURITY',
  projects: '10_PROJECTS',
  proj: '10_PROJECTS',
  archive: '99_ARCHIVE',
  inbox: '00_INBOX',
};

class DocumentService {
  constructor(options = {}) {
    this.rootPath = options.rootPath || process.env.DOCUMENT_ROOT || DEFAULT_ROOT;
    this.indexPath = path.join(this.rootPath, '_INDEX.md');
    this.documentIndex = new Map();
  }

  /**
   * Initialize the service and verify access
   */
  async initialize() {
    try {
      await fs.access(this.rootPath);
      await this.loadIndex();
      return { success: true, rootPath: this.rootPath };
    } catch (error) {
      return {
        success: false,
        error: `Cannot access document root: ${error.message}`,
        rootPath: this.rootPath
      };
    }
  }

  /**
   * List all documents in a category folder
   */
  async listDocuments(category = null) {
    const results = [];

    const foldersToScan = category
      ? [this.resolveFolderName(category)]
      : Object.values(FOLDER_MAPPING).filter((v, i, a) => a.indexOf(v) === i);

    for (const folder of foldersToScan) {
      const folderPath = path.join(this.rootPath, folder);

      try {
        const files = await fs.readdir(folderPath, { withFileTypes: true });

        for (const file of files) {
          if (file.isFile()) {
            const filePath = path.join(folderPath, file.name);
            const stats = await fs.stat(filePath);

            results.push({
              name: file.name,
              folder: folder,
              path: filePath,
              size: stats.size,
              modified: stats.mtime,
              created: stats.birthtime,
              extension: path.extname(file.name),
            });
          }
        }
      } catch (error) {
        // Folder doesn't exist or can't be read - skip
      }
    }

    return results;
  }

  /**
   * Search for documents by name pattern
   */
  async searchDocuments(pattern, options = {}) {
    const allDocs = await this.listDocuments(options.category);
    const regex = new RegExp(pattern, 'i');

    return allDocs.filter(doc => regex.test(doc.name));
  }

  /**
   * Move document to appropriate category folder
   */
  async fileDocument(sourcePath, category, newName = null) {
    const targetFolder = this.resolveFolderName(category);
    const fileName = newName || path.basename(sourcePath);
    const targetPath = path.join(this.rootPath, targetFolder, fileName);

    try {
      // Check if source exists
      await fs.access(sourcePath);

      // Move the file
      await fs.rename(sourcePath, targetPath);

      return {
        success: true,
        sourcePath,
        targetPath,
        folder: targetFolder,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sourcePath,
        targetFolder,
      };
    }
  }

  /**
   * Move document from inbox to appropriate folder
   */
  async triageInboxItem(fileName, category, newName = null) {
    const sourcePath = path.join(this.rootPath, '00_INBOX', fileName);
    return this.fileDocument(sourcePath, category, newName);
  }

  /**
   * Get inbox contents
   */
  async getInbox() {
    return this.listDocuments('inbox');
  }

  /**
   * Archive a document
   */
  async archiveDocument(sourcePath) {
    const datePrefix = new Date().toISOString().split('T')[0];
    const fileName = path.basename(sourcePath);
    const archiveName = `${datePrefix}_${fileName}`;

    return this.fileDocument(sourcePath, 'archive', archiveName);
  }

  /**
   * Read document content (text files only)
   */
  async readDocument(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const textExtensions = ['.txt', '.md', '.json', '.csv', '.log'];

      if (!textExtensions.includes(ext)) {
        return {
          success: false,
          error: `Cannot read binary file type: ${ext}`,
          filePath,
        };
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);

      return {
        success: true,
        content,
        filePath,
        size: stats.size,
        modified: stats.mtime,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        filePath,
      };
    }
  }

  /**
   * Write content to a document
   */
  async writeDocument(category, fileName, content) {
    const folder = this.resolveFolderName(category);
    const filePath = path.join(this.rootPath, folder, fileName);

    try {
      await fs.writeFile(filePath, content, 'utf-8');

      return {
        success: true,
        filePath,
        folder,
        fileName,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        folder,
        fileName,
      };
    }
  }

  /**
   * Create a new document from template
   */
  async createDocument(category, fileName, content = '') {
    return this.writeDocument(category, fileName, content);
  }

  /**
   * Get folder statistics
   */
  async getFolderStats() {
    const stats = {};
    const uniqueFolders = [...new Set(Object.values(FOLDER_MAPPING))];

    for (const folder of uniqueFolders) {
      const folderPath = path.join(this.rootPath, folder);

      try {
        const files = await fs.readdir(folderPath);
        let totalSize = 0;

        for (const file of files) {
          const filePath = path.join(folderPath, file);
          try {
            const stat = await fs.stat(filePath);
            if (stat.isFile()) totalSize += stat.size;
          } catch {}
        }

        stats[folder] = {
          fileCount: files.length,
          totalSize,
          path: folderPath,
        };
      } catch {
        stats[folder] = {
          fileCount: 0,
          totalSize: 0,
          path: folderPath,
          error: 'Folder not accessible',
        };
      }
    }

    return stats;
  }

  /**
   * Resolve category name to folder name
   */
  resolveFolderName(category) {
    const normalized = category.toLowerCase().trim();
    return FOLDER_MAPPING[normalized] || '00_INBOX';
  }

  /**
   * Load or refresh document index
   */
  async loadIndex() {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      // Parse index for quick lookups
      this.indexContent = content;
      return true;
    } catch {
      this.indexContent = null;
      return false;
    }
  }

  /**
   * Generate document report
   */
  async generateReport() {
    const stats = await this.getFolderStats();
    const inbox = await this.getInbox();

    let report = `# Document Repository Report\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += `## Inbox Status\n`;
    report += `Items pending triage: ${inbox.length}\n\n`;

    if (inbox.length > 0) {
      report += `### Inbox Items:\n`;
      for (const item of inbox) {
        report += `- ${item.name} (${(item.size / 1024).toFixed(1)} KB)\n`;
      }
      report += '\n';
    }

    report += `## Folder Statistics\n\n`;
    report += `| Folder | Files | Size |\n`;
    report += `|--------|-------|------|\n`;

    let totalFiles = 0;
    let totalSize = 0;

    for (const [folder, data] of Object.entries(stats)) {
      totalFiles += data.fileCount;
      totalSize += data.totalSize;
      report += `| ${folder} | ${data.fileCount} | ${(data.totalSize / 1024).toFixed(1)} KB |\n`;
    }

    report += `| **TOTAL** | **${totalFiles}** | **${(totalSize / 1024).toFixed(1)} KB** |\n`;

    return report;
  }
}

// Singleton instance
const documentService = new DocumentService();

export default documentService;
export { DocumentService, FOLDER_MAPPING };
