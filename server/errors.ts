export type BFFErrorCode =
  | 'TENANT_NOT_FOUND'
  | 'TENANT_SCOPE_REQUIRED'
  | 'PREVIEW_TENANT_NOT_CONFIGURED'
  | 'TENANT_ALREADY_EXISTS'
  | 'DOMAIN_ALREADY_CLAIMED'
  | 'PROVISIONING_FAILED'
  | 'TENANT_DISABLED'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'FORBIDDEN_SUPERADMIN_ONLY'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'TENANT_ISOLATION_ERROR'
  | 'INTEGRATION_NOT_CONFIGURED'
  | 'INTEGRATION_CAPABILITY_NOT_IMPLEMENTED'
  | 'INTEGRATION_AUTH_FAILED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'STORE_NOT_FOUND'
  | 'NO_STORES_AVAILABLE'
  | 'STORE_NOT_SERVICEABLE'
  | 'STORE_CLOSED'
  | 'FULFILLMENT_NOT_SUPPORTED'
  | 'MENU_NOT_AVAILABLE'
  | 'PRODUCT_NOT_AVAILABLE'
  | 'INVALID_BUNDLE_SELECTION'
  | 'BUNDLE_DISCOUNT_NOT_APPLIED'
  | 'BASKET_RECONCILIATION_REQUIRED'
  | 'BASKET_VALIDATION_FAILED'
  | 'DISPATCH_VALIDATION_EXPIRED'
  | 'PAYMENT_NOT_AUTHORISED'
  | 'CHECKOUT_PENDING'
  | 'CHECKOUT_FAILED'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_CUSTOMER_MISMATCH'
  | 'MEDIA_UPLOAD_FAILED'
  | 'STORAGE_NOT_CONFIGURED'
  | 'VALIDATION_ERROR'
  | 'INVALID_INPUT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UPSTREAM_CIRCUIT_OPEN'
  | 'POLICY_NOT_FOUND'
  | 'DATABASE_UNAVAILABLE'
  | 'DATABASE_PERMISSION_DENIED'
  | 'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED'
  | 'INVALID_FULFILLMENT'
  | 'DISPATCH_ASSIGNMENT_FORBIDDEN'
  | 'ORDER_UNACCEPTED_TIMEOUT'
  | 'RULE_VIOLATION'
  | 'INTERNAL_ERROR';

export const ErrorCode = {
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND' as BFFErrorCode,
  TENANT_SCOPE_REQUIRED: 'TENANT_SCOPE_REQUIRED' as BFFErrorCode,
  PREVIEW_TENANT_NOT_CONFIGURED: 'PREVIEW_TENANT_NOT_CONFIGURED' as BFFErrorCode,
  TENANT_ALREADY_EXISTS: 'TENANT_ALREADY_EXISTS' as BFFErrorCode,
  DOMAIN_ALREADY_CLAIMED: 'DOMAIN_ALREADY_CLAIMED' as BFFErrorCode,
  PROVISIONING_FAILED: 'PROVISIONING_FAILED' as BFFErrorCode,
  TENANT_DISABLED: 'TENANT_DISABLED' as BFFErrorCode,
  AUTH_REQUIRED: 'AUTH_REQUIRED' as BFFErrorCode,
  FORBIDDEN: 'FORBIDDEN' as BFFErrorCode,
  FORBIDDEN_SUPERADMIN_ONLY: 'FORBIDDEN_SUPERADMIN_ONLY' as BFFErrorCode,
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS' as BFFErrorCode,
  TENANT_ISOLATION_ERROR: 'TENANT_ISOLATION_ERROR' as BFFErrorCode,
  INTEGRATION_NOT_CONFIGURED: 'INTEGRATION_NOT_CONFIGURED' as BFFErrorCode,
  INTEGRATION_CAPABILITY_NOT_IMPLEMENTED: 'INTEGRATION_CAPABILITY_NOT_IMPLEMENTED' as BFFErrorCode,
  INTEGRATION_AUTH_FAILED: 'INTEGRATION_AUTH_FAILED' as BFFErrorCode,
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE' as BFFErrorCode,
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT' as BFFErrorCode,
  UPSTREAM_CIRCUIT_OPEN: 'UPSTREAM_CIRCUIT_OPEN' as BFFErrorCode,
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED' as BFFErrorCode,
  POLICY_NOT_FOUND: 'POLICY_NOT_FOUND' as BFFErrorCode,
  STORE_NOT_FOUND: 'STORE_NOT_FOUND' as BFFErrorCode,
  NO_STORES_AVAILABLE: 'NO_STORES_AVAILABLE' as BFFErrorCode,
  STORE_NOT_SERVICEABLE: 'STORE_NOT_SERVICEABLE' as BFFErrorCode,
  MENU_NOT_AVAILABLE: 'MENU_NOT_AVAILABLE' as BFFErrorCode,
  PRODUCT_NOT_AVAILABLE: 'PRODUCT_NOT_AVAILABLE' as BFFErrorCode,
  INVALID_BUNDLE_SELECTION: 'INVALID_BUNDLE_SELECTION' as BFFErrorCode,
  BUNDLE_DISCOUNT_NOT_APPLIED: 'BUNDLE_DISCOUNT_NOT_APPLIED' as BFFErrorCode,
  BASKET_RECONCILIATION_REQUIRED: 'BASKET_RECONCILIATION_REQUIRED' as BFFErrorCode,
  BASKET_VALIDATION_FAILED: 'BASKET_VALIDATION_FAILED' as BFFErrorCode,
  DISPATCH_VALIDATION_EXPIRED: 'DISPATCH_VALIDATION_EXPIRED' as BFFErrorCode,
  PAYMENT_NOT_AUTHORISED: 'PAYMENT_NOT_AUTHORISED' as BFFErrorCode,
  CHECKOUT_PENDING: 'CHECKOUT_PENDING' as BFFErrorCode,
  CHECKOUT_FAILED: 'CHECKOUT_FAILED' as BFFErrorCode,
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND' as BFFErrorCode,
  ORDER_CUSTOMER_MISMATCH: 'ORDER_CUSTOMER_MISMATCH' as BFFErrorCode,
  MEDIA_UPLOAD_FAILED: 'MEDIA_UPLOAD_FAILED' as BFFErrorCode,
  STORAGE_NOT_CONFIGURED: 'STORAGE_NOT_CONFIGURED' as BFFErrorCode,
  VALIDATION_ERROR: 'VALIDATION_ERROR' as BFFErrorCode,
  INVALID_INPUT: 'VALIDATION_ERROR' as BFFErrorCode,
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE' as BFFErrorCode,
  DATABASE_PERMISSION_DENIED: 'DATABASE_PERMISSION_DENIED' as BFFErrorCode,
  UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED: 'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED' as BFFErrorCode,
  INVALID_FULFILLMENT: 'INVALID_FULFILLMENT' as BFFErrorCode,
  DISPATCH_ASSIGNMENT_FORBIDDEN: 'DISPATCH_ASSIGNMENT_FORBIDDEN' as BFFErrorCode,
  ORDER_UNACCEPTED_TIMEOUT: 'ORDER_UNACCEPTED_TIMEOUT' as BFFErrorCode,
  RULE_VIOLATION: 'RULE_VIOLATION' as BFFErrorCode,
  INTERNAL_ERROR: 'INTERNAL_ERROR' as BFFErrorCode,
} as const;

export type ErrorCode = BFFErrorCode;

export interface BFFErrorPayload {
  code: BFFErrorCode;
  safeMessage: string;
  requestId?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export class BFFError extends Error {
  public readonly code: BFFErrorCode;
  public readonly statusCode: number;
  public readonly safeMessage: string;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;
  public requestId?: string;

  constructor(
    code: BFFErrorCode,
    safeMessage: string,
    statusCode: number = 400,
    retryable: boolean = false,
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(safeMessage);
    this.name = 'BFFError';
    this.code = code;
    this.statusCode = statusCode;
    this.safeMessage = safeMessage;
    this.retryable = retryable;
    this.details = details;
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toPayload(requestId?: string): BFFErrorPayload {
    return {
      code: this.code,
      safeMessage: this.safeMessage,
      requestId: requestId || this.requestId,
      retryable: this.retryable,
      ...(this.details ? { details: this.details } : {}),
    };
  }

  static invalidInput(safeMessage: string, details?: Record<string, unknown>, requestId?: string): BFFError {
    return new BFFError('VALIDATION_ERROR', safeMessage, 400, false, details, requestId);
  }

  static badRequest(safeMessage: string, details?: Record<string, unknown>, requestId?: string): BFFError {
    return new BFFError('VALIDATION_ERROR', safeMessage, 400, false, details, requestId);
  }

  static notFound(safeMessage: string, details?: Record<string, unknown>, requestId?: string): BFFError {
    return new BFFError('ORDER_NOT_FOUND', safeMessage, 404, false, details, requestId);
  }

  static forbidden(safeMessage: string, details?: Record<string, unknown>, requestId?: string): BFFError {
    return new BFFError('FORBIDDEN', safeMessage, 403, false, details, requestId);
  }

  static tenantIsolationError(safeMessage: string, details?: Record<string, unknown>, requestId?: string): BFFError {
    return new BFFError('TENANT_ISOLATION_ERROR', safeMessage, 403, false, details, requestId);
  }

  static internal(safeMessage: string, details?: Record<string, unknown>, requestId?: string): BFFError {
    return new BFFError('INTERNAL_ERROR', safeMessage, 500, false, details, requestId);
  }
}

export class CommerceError extends BFFError {
  constructor(
    code: BFFErrorCode,
    safeMessage: string,
    statusCode: number = 400,
    retryable: boolean = false,
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(code, safeMessage, statusCode, retryable, details, requestId);
    this.name = 'CommerceError';
  }
}

