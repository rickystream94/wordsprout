import type { ItemDefinition } from '@azure/cosmos';
import type { CosmosClientWrapper } from './cosmos';

/**
 * In-memory Map-based Cosmos DB mock for the `local` APP_ENV stage.
 * All data is stored in a flat Map keyed by document `id`.
 * Data is lost when the Function host restarts — appropriate for local dev only.
 */
export function createMockCosmosClient(): CosmosClientWrapper {
  const store = new Map<string, ItemDefinition>();

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
      return document;
    },

    async deleteItem(id: string, _partitionKey: string): Promise<void> {
      store.delete(id);
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
