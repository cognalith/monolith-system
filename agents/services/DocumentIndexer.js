/**
 * MONOLITH OS - Document Indexer
 * Maintains a searchable index of all documents in the repository
 *
 * Features:
 * - Full document inventory
 * - Metadata extraction
 * - Change detection
 * - Search capabilities
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_ROOT = '/mnt/h/My Drive/MONOLITH_OS';

class DocumentIndexer {
  constructor(options = {}) {
    this.rootPath = options.rootPath || process.env.DOCUMENT_ROOT || DEFAULT_ROOT;
    this.indexFile = path.join(this.rootPath, '.document_index.json');
    this.index = {
      version: '1.0',
      lastUpdated: null,
      totalDocuments: 0,
      documents: {},
      byCategory: {},
      byExtension: {},
      recentChanges: [],
    };
    this.initialized = false;
  }

  /**
   * Initialize the indexer
   */
  async initialize() {
    try {
      // Try to load existing index
      const existingIndex = await this.loadIndex();
      if (existingIndex) {
        this.index = existingIndex;
      }
      this.initialized = true;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Load existing index from file
   */
  async loadIndex() {
    try {
      const content = await fs.readFile(this.indexFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Save index to file
   */
  async saveIndex() {
    this.index.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.indexFile, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  /**
   * Generate hash for change detection
   */
  generateHash(filePath, stats) {
    const data = `${filePath}|${stats.size}|${stats.mtime.getTime()}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Rebuild the entire index
   */
  async rebuildIndex() {
    const newIndex = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      totalDocuments: 0,
      documents: {},
      byCategory: {},
      byExtension: {},
      recentChanges: [],
    };

    const folders = await fs.readdir(this.rootPath, { withFileTypes: true });

    for (const folder of folders) {
      if (!folder.isDirectory()) continue;
      if (folder.name.startsWith('.')) continue;

      const folderPath = path.join(this.rootPath, folder.name);
      const category = folder.name;

      newIndex.byCategory[category] = [];

      try {
        const files = await fs.readdir(folderPath, { withFileTypes: true });

        for (const file of files) {
          if (!file.isFile()) continue;
          if (file.name.startsWith('.')) continue;

          const filePath = path.join(folderPath, file.name);
          const stats = await fs.stat(filePath);
          const ext = path.extname(file.name).toLowerCase();
          const hash = this.generateHash(filePath, stats);

          const docEntry = {
            name: file.name,
            path: filePath,
            relativePath: `${category}/${file.name}`,
            category,
            extension: ext,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
            hash,
          };

          newIndex.documents[filePath] = docEntry;
          newIndex.byCategory[category].push(filePath);

          if (!newIndex.byExtension[ext]) {
            newIndex.byExtension[ext] = [];
          }
          newIndex.byExtension[ext].push(filePath);

          newIndex.totalDocuments++;
        }
      } catch (error) {
        // Skip inaccessible folders
      }
    }

    // Detect changes from previous index
    if (this.index.documents) {
      const oldPaths = new Set(Object.keys(this.index.documents));
      const newPaths = new Set(Object.keys(newIndex.documents));

      // Find added documents
      for (const path of newPaths) {
        if (!oldPaths.has(path)) {
          newIndex.recentChanges.push({
            type: 'added',
            path,
            timestamp: new Date().toISOString(),
          });
        } else if (this.index.documents[path].hash !== newIndex.documents[path].hash) {
          newIndex.recentChanges.push({
            type: 'modified',
            path,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Find removed documents
      for (const path of oldPaths) {
        if (!newPaths.has(path)) {
          newIndex.recentChanges.push({
            type: 'removed',
            path,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Keep only last 100 changes
      newIndex.recentChanges = newIndex.recentChanges.slice(-100);
    }

    this.index = newIndex;
    await this.saveIndex();

    return {
      totalDocuments: newIndex.totalDocuments,
      categories: Object.keys(newIndex.byCategory).length,
      changes: newIndex.recentChanges.length,
    };
  }

  /**
   * Search documents by name
   */
  search(query, options = {}) {
    const results = [];
    const regex = new RegExp(query, 'i');

    for (const [filePath, doc] of Object.entries(this.index.documents)) {
      if (regex.test(doc.name)) {
        if (options.category && doc.category !== options.category) continue;
        if (options.extension && doc.extension !== options.extension) continue;

        results.push(doc);
      }
    }

    // Sort by modified date (newest first)
    results.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    return options.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Get documents by category
   */
  getByCategory(category) {
    const paths = this.index.byCategory[category] || [];
    return paths.map(p => this.index.documents[p]).filter(Boolean);
  }

  /**
   * Get documents by extension
   */
  getByExtension(extension) {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    const paths = this.index.byExtension[ext] || [];
    return paths.map(p => this.index.documents[p]).filter(Boolean);
  }

  /**
   * Get recent changes
   */
  getRecentChanges(limit = 20) {
    return this.index.recentChanges.slice(-limit).reverse();
  }

  /**
   * Get index statistics
   */
  getStats() {
    const categoryStats = {};
    for (const [cat, paths] of Object.entries(this.index.byCategory)) {
      categoryStats[cat] = paths.length;
    }

    const extensionStats = {};
    for (const [ext, paths] of Object.entries(this.index.byExtension)) {
      extensionStats[ext] = paths.length;
    }

    return {
      totalDocuments: this.index.totalDocuments,
      lastUpdated: this.index.lastUpdated,
      categories: categoryStats,
      extensions: extensionStats,
      recentChangesCount: this.index.recentChanges.length,
    };
  }

  /**
   * Get document by path
   */
  getDocument(filePath) {
    return this.index.documents[filePath] || null;
  }

  /**
   * Get recently modified documents
   */
  getRecentlyModified(limit = 10) {
    const docs = Object.values(this.index.documents);
    docs.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    return docs.slice(0, limit);
  }
}

// Singleton instance
const documentIndexer = new DocumentIndexer();

export default documentIndexer;
export { DocumentIndexer };
