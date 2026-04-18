import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ItemDefinition } from '@azure/cosmos';
import type { CosmosClientWrapper } from './cosmos';

const MOCK_FILE = path.resolve(process.cwd(), '.cosmos-mock.json');

/**
 * Load persisted store from disk, or return an empty Map if none exists.
 */
function loadStore(): Map<string, ItemDefinition> {
  try {
    if (fs.existsSync(MOCK_FILE)) {
      const data = JSON.parse(fs.readFileSync(MOCK_FILE, 'utf-8')) as [string, ItemDefinition][];
      return new Map(data);
    }
  } catch {
    // Corrupt file — start fresh
  }
  return new Map();
}

function saveStore(store: Map<string, ItemDefinition>): void {
  try {
    fs.writeFileSync(MOCK_FILE, JSON.stringify([...store.entries()], null, 2));
  } catch {
    // Best-effort — ignore write failures in local dev
  }
}

/**
 * File-backed Map Cosmos DB mock for the `local` APP_ENV stage.
 * Data is persisted to .cosmos-mock.json so it survives Function host restarts.
 */
export function createMockCosmosClient(): CosmosClientWrapper {
  const store = loadStore();

  return {
    async pointRead<T extends ItemDefinition>(
      id: string,
      _partitionKey: string,
    ): Promise<T | null> {
      const doc = store.get(id);
      return doc ? (doc as T) : null;
    },

    async upsert<T extends ItemDefinition>(document: T): Promise<T> {
      store.set(document.id as string, document);
      saveStore(store);
      return document;
    },

    async deleteItem(id: string, _partitionKey: string): Promise<void> {
      store.delete(id);
      saveStore(store);
    },

    async queryByPartition<T extends ItemDefinition>(
      partitionKey: string,
      filters: Record<string, unknown>,
    ): Promise<T[]> {
      const results: T[] = [];
      for (const doc of store.values()) {
        if ((doc as Record<string, unknown>)['userId'] !== partitionKey) continue;
        const matches = Object.entries(filters).every(
          ([key, value]) => (doc as Record<string, unknown>)[key] === value,
        );
        if (matches) results.push(doc as T);
      }
      return results;
    },
  };
}
