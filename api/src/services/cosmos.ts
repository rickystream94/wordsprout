import { CosmosClient, type ItemDefinition } from '@azure/cosmos';
import {
  COSMOS_CONTAINER,
  COSMOS_DATABASE,
  COSMOS_ENDPOINT,
  COSMOS_KEY,
  IS_LOCAL,
} from '../config/env';
import { createMockCosmosClient } from './cosmos.mock';

// ─── Interface for the Cosmos client wrapper ──────────────────────────────────

export interface CosmosClientWrapper {
  /**
   * Point-read a single document by id + partitionKey (userId).
   * Returns null when the document does not exist (404).
   */
  pointRead<T extends ItemDefinition>(id: string, partitionKey: string): Promise<T | null>;

  /** Upsert a document. Overwrites if exists, creates if not. */
  upsert<T extends ItemDefinition>(document: T): Promise<T>;

  /** Delete a document. Does NOT throw on 404. */
  deleteItem(id: string, partitionKey: string): Promise<void>;

  /**
   * Query all documents in a partition that match the given WHERE predicates.
   * `partitionKey` scopes the query to one user's data.
   */
  queryByPartition<T extends ItemDefinition>(
    partitionKey: string,
    filters: Record<string, unknown>,
  ): Promise<T[]>;
}

// ─── Real Cosmos DB implementation ───────────────────────────────────────────

function buildRealClient(): CosmosClientWrapper {
  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY });
  const container = client.database(COSMOS_DATABASE).container(COSMOS_CONTAINER);

  return {
    async pointRead<T extends ItemDefinition>(
      id: string,
      partitionKey: string,
    ): Promise<T | null> {
      const { resource, statusCode } = await container.item(id, partitionKey).read<T>();
      if (statusCode === 404 || resource === undefined) return null;
      return resource;
    },

    async upsert<T extends ItemDefinition>(document: T): Promise<T> {
      const { resource } = await container.items.upsert<T>(document);
      if (!resource) throw new Error('Cosmos upsert returned no resource');
      return resource;
    },

    async deleteItem(id: string, partitionKey: string): Promise<void> {
      try {
        await container.item(id, partitionKey).delete();
      } catch (err: unknown) {
        // Ignore 404 — idempotent delete
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: number }).code === 404
        ) {
          return;
        }
        throw err;
      }
    },

    async queryByPartition<T extends ItemDefinition>(
      partitionKey: string,
      filters: Record<string, unknown>,
    ): Promise<T[]> {
      const conditions = Object.entries(filters)
        .map(([key]) => `c.${key} = @${key}`)
        .join(' AND ');

      const parameters: { name: string; value: string }[] = Object.entries(filters).map(([key, value]) => ({
        name: `@${key}`,
        value: String(value),
      }));

      const query = conditions
        ? `SELECT * FROM c WHERE ${conditions}`
        : 'SELECT * FROM c';

      const { resources } = await container.items
        .query<T>({ query, parameters }, { partitionKey })
        .fetchAll();

      return resources;
    },
  };
}

// ─── Export — swap between real and mock based on APP_ENV ─────────────────────

export const cosmosClient: CosmosClientWrapper = IS_LOCAL
  ? createMockCosmosClient()
  : buildRealClient();
