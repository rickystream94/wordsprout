import { vi } from 'vitest';
import type { CosmosClientWrapper } from '../services/cosmos';

/**
 * Creates a fresh in-memory CosmosClientWrapper mock.
 * All methods are vi.fn() stubs with safe default return values.
 * Call this inside vi.hoisted() so vi.mock factories can reference the result.
 */
export function createCosmosMock(): CosmosClientWrapper {
  return {
    pointRead: vi.fn(async () => null),
    upsert: vi.fn(async (doc: unknown) => doc),
    deleteItem: vi.fn(async () => undefined),
    queryByPartition: vi.fn(async () => []),
    queryByPartitionPaginated: vi.fn(async () => ({ items: [], continuationToken: undefined })),
    deleteAllForPartition: vi.fn(async () => 0),
    queryById: vi.fn(async () => []),
    queryByTagInPartition: vi.fn(async () => []),
  } as unknown as CosmosClientWrapper;
}
