import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Source = {
  id: string;
  kind: 'repository_implementation' | 'official_documentation';
  path?: string;
  revision?: string;
  blobSha?: string;
  url?: string;
  access?: string;
  publicContract?: boolean;
};

type Claim = {
  id: string;
  status: 'SHIPPED' | 'PLANNED' | 'CONSTRAINT' | 'EXTERNAL_CONCEPT';
  statement: string;
  sources: string[];
};

type KnowledgePack = {
  schemaVersion: number;
  packVersion: string;
  repository: { name: string; branch: string; revision: string };
  scope: {
    tenantNeutral: boolean;
    deliverectMode: string;
    operationalAccessGranted: boolean;
    customerDataIncluded: boolean;
    archiveImported: boolean;
    internalRoutesArePublicContracts: boolean;
  };
  integration: {
    status: string;
    productionCaller: string | null;
    coordinatedTarget: string;
  };
  sources: Source[];
  claims: Claim[];
  examples: Array<{ id: string; user: string; answerOutline: string; claimIds: string[] }>;
};

const pack = JSON.parse(
  readFileSync(new URL('../../data/altie/knowledge-pack.v1.json', import.meta.url), 'utf8')
) as KnowledgePack;

describe('Altie knowledge-pack provenance', () => {
  it('is tenant-neutral and pinned to an exact main revision', () => {
    expect(pack.schemaVersion).toBe(1);
    expect(pack.packVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pack.repository).toEqual({
      name: 'DjL88/David-Victor',
      branch: 'main',
      revision: 'd6a8e0e265e6e04647adcdec81591e9387e1d607',
    });
    expect(pack.scope.tenantNeutral).toBe(true);
    expect(pack.scope.customerDataIncluded).toBe(false);
    expect(pack.scope.archiveImported).toBe(false);
  });

  it('keeps explanatory knowledge separate from runtime permission', () => {
    expect(pack.scope.deliverectMode).toBe('explanatory_only');
    expect(pack.scope.operationalAccessGranted).toBe(false);
    expect(pack.scope.internalRoutesArePublicContracts).toBe(false);
  });

  it('does not describe the pack as shipped before a production caller exists', () => {
    expect(pack.integration.status).toBe('PREPARED_NOT_WIRED');
    expect(pack.integration.productionCaller).toBeNull();
    expect(pack.integration.coordinatedTarget).toBe('server/admin/adminAssistantChatService.ts');
    expect(pack.claims.find((claim) => claim.id === 'lt.packIntegration')?.status).toBe('PLANNED');
  });

  it('pins every repository source to a revision and blob', () => {
    const repositorySources = pack.sources.filter((source) => source.kind === 'repository_implementation');
    expect(repositorySources.length).toBeGreaterThan(0);
    for (const source of repositorySources) {
      expect(source.path).toBeTruthy();
      expect(source.revision).toBe(pack.repository.revision);
      expect(source.blobSha).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('keeps source paths bounded to reviewed implementation files', () => {
    const paths = pack.sources
      .filter((source) => source.kind === 'repository_implementation')
      .map((source) => source.path || '');
    expect(paths.some((path) => path.startsWith('.env'))).toBe(false);
    expect(paths).not.toContain('server/secrets.ts');
    expect(paths.some((path) => path.toLowerCase().includes('dllm'))).toBe(false);
  });

  it('uses only official Deliverect documentation hosts for external concepts', () => {
    const official = pack.sources.filter((source) => source.kind === 'official_documentation');
    expect(official.length).toBeGreaterThan(0);
    for (const source of official) {
      const host = new URL(source.url || '').hostname;
      expect(['developers.deliverect.com', 'resources.developers.deliverect.com']).toContain(host);
      expect(source.access).toBe('explanatory_only');
    }
  });

  it('requires sources for shipped and external-concept claims', () => {
    const sourceIds = new Set(pack.sources.map((source) => source.id));
    for (const claim of pack.claims) {
      expect(['SHIPPED', 'PLANNED', 'CONSTRAINT', 'EXTERNAL_CONCEPT']).toContain(claim.status);
      if (claim.status === 'SHIPPED' || claim.status === 'EXTERNAL_CONCEPT') {
        expect(claim.sources.length).toBeGreaterThan(0);
      }
      for (const sourceId of claim.sources) expect(sourceIds.has(sourceId)).toBe(true);
    }
  });

  it('grounds every example in known claims', () => {
    const claimIds = new Set(pack.claims.map((claim) => claim.id));
    expect(pack.examples.length).toBeGreaterThanOrEqual(6);
    for (const example of pack.examples) {
      expect(example.user.trim().length).toBeGreaterThan(0);
      expect(example.answerOutline.trim().length).toBeGreaterThan(0);
      expect(example.claimIds.length).toBeGreaterThan(0);
      for (const claimId of example.claimIds) expect(claimIds.has(claimId)).toBe(true);
    }
  });

  it('marks the internal router source as non-public', () => {
    const router = pack.sources.find((source) => source.id === 'repo.router');
    expect(router?.publicContract).toBe(false);
    expect(pack.claims.find((claim) => claim.id === 'lt.internalRoutes')?.status).toBe('CONSTRAINT');
  });
});
