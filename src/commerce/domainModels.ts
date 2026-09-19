/**
 * Custom Domains Domain Model
 * Manages custom tenant domain bindings, verification states, and SSL provisioning.
 */

export type DomainStatus =
  | 'NOT_CONFIGURED'
  | 'AWAITING_DNS'
  | 'VERIFYING'
  | 'SSL_PROVISIONING'
  | 'ACTIVE'
  | 'FAILED';

export type DnsRecordType = 'CNAME' | 'A' | 'ALIAS' | 'TXT';

export interface DnsInstruction {
  type: DnsRecordType;
  host: string; // e.g. "shop" or "@"
  target: string; // e.g. "domains.platform.example" or "76.76.21.21"
  ttl: string; // e.g. "3600" or "Auto"
  purpose: 'ROUTING' | 'OWNERSHIP_VERIFICATION' | 'APEX_ROUTING';
  verificationToken?: string;
  isConfigured?: boolean;
}

export interface CustomDomainConfig {
  id: string;
  tenantId: string;
  domain: string; // e.g. "shop.chelmsfordgrocer.co.uk"
  isApex: boolean;
  status: DomainStatus;
  primary: boolean;
  sslCertificate: {
    issuer?: string;
    expiresAt?: string;
    status: 'pending' | 'valid' | 'expired';
  };
  dnsInstructions: DnsInstruction[];
  lastCheckedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDomainsResponse {
  defaultPlatformDomain: string; // e.g. "brand-alpha.stores.platform.example"
  customDomains: CustomDomainConfig[];
}

export interface DomainMappingRecord {
  domainId: string;
  hostname: string;
  tenantId: string;
  isPrimary?: boolean;
  status?: 'active' | 'pending';
  createdAt?: string;
  updatedAt?: string;
}

