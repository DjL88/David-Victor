import { describe, it, expect, beforeEach } from 'vitest';
import {
  PaymentService,
  setDPayAdapter,
  resetDPayAdapter,
  getDPayAdapter,
} from '../../server/deliverect/PaymentService';
import { DemoPaymentAdapter } from '../../server/deliverect/DemoPaymentAdapter';
import { DeliverectDPayAdapter } from '../../server/deliverect/DeliverectDPayAdapter';
import { IntegrationUnavailableDPayAdapter } from '../../server/deliverect/IntegrationUnavailableDPayAdapter';
import { FirestorePlatformService } from '../../server/firestoreService';
import { CommerceError, ErrorCode } from '../../server/errors';
import {
  DPayRequestPaymentSchema,
  CapturePaymentSchema,
  CalculateCeilingSchema,
  RefundPaymentSchema,
  ReauthorizePaymentSchema,
} from '../../server/api/schemas';

describe('Phase 11: Deliverect Pay (DPay) Integration & Staging Test Matrix (PAY-01 to PAY-10)', () => {
  const testTenant = 'brand-alpha';
  const testChannelLinkId = 'store-chelmsford-central';
  let demoAdapter: DemoPaymentAdapter;

  beforeEach(() => {
    resetDPayAdapter();
    demoAdapter = new DemoPaymentAdapter();
    setDPayAdapter(demoAdapter);
    process.env.APP_MODE = 'demo';
  });

  // ========================================================
  // Section 20 & PAY-06: Authorization Ceiling Calculation & Buffer Ban
  // ========================================================
  describe('Authorization Ceiling & Strict Ban on Percentage Buffers (Section 20)', () => {
    it('calculates the authorized ceiling using only customer-approved components', () => {
      const basketTotal = { amount: 2000, currency: 'GBP' }; // £20.00
      const substituteUplift = { amount: 350, currency: 'GBP' }; // £3.50
      const catchWeightTolerance = { amount: 150, currency: 'GBP' }; // £1.50
      const agreedCharges = [{ amount: 50, currency: 'GBP' }]; // £0.50 bag fee

      const ceiling = PaymentService.calculateApprovedAuthorizationCeiling(basketTotal, {
        approvedSubstituteUplift: substituteUplift,
        approvedCatchWeightTolerance: catchWeightTolerance,
        explicitAgreedCharges: agreedCharges,
      });

      // 2000 + 350 + 150 + 50 = 2550
      expect(ceiling.amount).toBe(2550);
      expect(ceiling.currency).toBe('GBP');
    });

    it('STRICTLY PROHIBITS arbitrary percentage buffers (e.g. 10% or 15%)', () => {
      const basketTotal = { amount: 2000, currency: 'GBP' };

      expect(() => {
        PaymentService.calculateApprovedAuthorizationCeiling(basketTotal, {
          safetyBufferPercentage: 10,
        } as any);
      }).toThrowError(/Arbitrary safety buffers or percentage markups/);

      expect(() => {
        PaymentService.calculateApprovedAuthorizationCeiling(basketTotal, {
          arbitraryBufferPercentage: 15,
        } as any);
      }).toThrowError(/Arbitrary safety buffers or percentage markups/);
    });

    it('rejects currency mismatches in ceiling components', () => {
      const basketTotal = { amount: 2000, currency: 'GBP' };
      const substituteUplift = { amount: 300, currency: 'EUR' }; // mismatch

      expect(() => {
        PaymentService.calculateApprovedAuthorizationCeiling(basketTotal, {
          approvedSubstituteUplift: substituteUplift,
        });
      }).toThrowError(/Currency mismatch/);
    });

    it('validates CalculateCeilingSchema correctly', () => {
      const valid = CalculateCeilingSchema.safeParse({
        reconciledBasketTotal: { amount: 1500, currency: 'GBP' },
        approvedSubstituteUplift: { amount: 200, currency: 'GBP' },
      });
      expect(valid.success).toBe(true);
    });
  });

  // ========================================================
  // PAY-01: Payment Gateway Profiles Discovery
  // ========================================================
  describe('PAY-01: Payment Gateway Discovery', () => {
    it('retrieves configured payment gateways for a channelLinkId', async () => {
      const gateways = await PaymentService.getPaymentGateways(testChannelLinkId, testTenant);
      expect(Array.isArray(gateways)).toBe(true);
      expect(gateways.length).toBeGreaterThan(0);
      expect(gateways[0].id).toBeDefined();
      expect(gateways[0].supportedMethods).toContain('card');
    });
  });

  // ========================================================
  // PAY-02 & Section 21: Tokenization & Raw PAN/CVC Protection
  // ========================================================
  describe('PAY-02 & Section 21: Tokenization & Raw Card Details Protection', () => {
    it('creates opaque tokenized credentials without exposing raw PAN/CVC', async () => {
      const token = await demoAdapter.createToken({
        cardNumberMasked: '•••• •••• •••• 4242',
        cardholderName: 'Jane Customer',
        brand: 'Visa',
        last4: '4242',
      });

      expect(token).toBeDefined();
      expect(token.tokenId).toMatch(/^tok_/);
      expect(token.last4).toBe('4242');
      expect(token.brand).toBe('Visa');
    });

    it('strictly rejects raw card details (PAN/CVC) in payment requests', async () => {
      const rawCardRequest: any = {
        channelLinkId: testChannelLinkId,
        mode: { type: 'token', tokenId: 'tok_demo_123' },
        amount: 2500,
        currency: 'GBP',
        captureMode: 'manual',
        metadata: {
          pan: '4242424242424242', // Attempted raw card leak
          cvc: '123',
        },
      };

      await expect(
        PaymentService.requestPayment(rawCardRequest, testTenant)
      ).rejects.toThrowError(/Raw PAN\/CVC detected/);
    });

    it('rejects un-tokenized payment modes', async () => {
      const invalidModeRequest: any = {
        channelLinkId: testChannelLinkId,
        mode: { type: 'card' }, // Missing tokenId
        amount: 2500,
        currency: 'GBP',
        captureMode: 'manual',
      };

      await expect(
        PaymentService.requestPayment(invalidModeRequest, testTenant)
      ).rejects.toThrowError(/tokenized payment credentials/);
    });
  });

  // ========================================================
  // PAY-03: Channel/Store Link Validation
  // ========================================================
  describe('PAY-03: Channel Link Validation', () => {
    it('rejects empty or missing channelLinkId in request', async () => {
      const parsed = DPayRequestPaymentSchema.safeParse({
        channelLinkId: '',
        mode: { type: 'token', tokenId: 'tok_valid_123' },
        amount: 2000,
        currency: 'GBP',
      });
      expect(parsed.success).toBe(false);
    });
  });

  // ========================================================
  // PAY-04 & PAY-05: Manual Authorization & Minor Units Enforcement
  // ========================================================
  describe('PAY-04 & PAY-05: Manual Authorization & Integer Minor Units', () => {
    it('authorizes payments with captureMode: manual (PAY-04)', async () => {
      const payment = await PaymentService.requestPayment(
        {
          channelLinkId: testChannelLinkId,
          mode: { type: 'token', tokenId: 'tok_visa_4242' },
          amount: 2250, // £22.50
          currency: 'GBP',
          captureMode: 'manual',
          orderReference: 'ORD-TEST-001',
        },
        testTenant
      );

      expect(payment).toBeDefined();
      expect(payment.paymentId).toMatch(/^dpay_/);
      expect(payment.status).toBe('authorized');
      expect(payment.captureMode).toBe('manual');
      expect(payment.amount).toBe(2250);
      expect(payment.authorizedAmount).toBe(2250);
      expect(payment.capturedAmount).toBe(0);

      // Verify Firestore payment projection was saved
      const saved = await FirestorePlatformService.getPaymentProjection(payment.paymentId);
      expect(saved).not.toBeNull();
      expect(saved?.status).toBe('authorized');
      expect(saved?.authorizedAmount.amount).toBe(2250);
    });

    it('strictly enforces integer minor units and rejects floating-point amounts (PAY-05)', async () => {
      // Floating-point amount should be rejected by Zod schema
      const floatParsed = DPayRequestPaymentSchema.safeParse({
        channelLinkId: testChannelLinkId,
        mode: { type: 'token', tokenId: 'tok_demo' },
        amount: 22.5, // Invalid float
        currency: 'GBP',
      });
      expect(floatParsed.success).toBe(false);

      // Negative or zero amount should also be rejected
      const zeroParsed = DPayRequestPaymentSchema.safeParse({
        channelLinkId: testChannelLinkId,
        mode: { type: 'token', tokenId: 'tok_demo' },
        amount: 0,
        currency: 'GBP',
      });
      expect(zeroParsed.success).toBe(false);
    });
  });

  // ========================================================
  // PAY-06: Customer-Approved Maximum Authorization Ceiling
  // ========================================================
  describe('PAY-06: Customer-Approved Maximum Authorization Ceiling Check', () => {
    it('permits authorization up to customerApprovedMaxAmount', async () => {
      const payment = await PaymentService.requestPayment(
        {
          channelLinkId: testChannelLinkId,
          mode: { type: 'token', tokenId: 'tok_visa_4242' },
          amount: 2500, // £25.00
          currency: 'GBP',
          captureMode: 'manual',
          customerApprovedMaxAmount: {
            amount: 2500,
            currency: 'GBP',
          },
        },
        testTenant
      );

      expect(payment.status).toBe('authorized');
      expect(payment.authorizedAmount).toBe(2500);
    });

    it('rejects authorization when amount exceeds customerApprovedMaxAmount', async () => {
      await expect(
        PaymentService.requestPayment(
          {
            channelLinkId: testChannelLinkId,
            mode: { type: 'token', tokenId: 'tok_visa_4242' },
            amount: 3000, // £30.00
            currency: 'GBP',
            captureMode: 'manual',
            customerApprovedMaxAmount: {
              amount: 2500, // Max approved is £25.00
              currency: 'GBP',
            },
          },
          testTenant
        )
      ).rejects.toThrowError(/exceeds customer-approved maximum authorized ceiling/);
    });
  });

  // ========================================================
  // PAY-07: Partial / Final Capture Below Ceiling & Residual Hold Tracking
  // ========================================================
  describe('PAY-07: Partial Capture Below Ceiling & Residual Hold Release', () => {
    it('captures final amount lower than authorization and tracks residual hold', async () => {
      // 1. Authorize £25.00 ceiling
      const payment = await PaymentService.requestPayment(
        {
          channelLinkId: testChannelLinkId,
          mode: { type: 'token', tokenId: 'tok_visa_4242' },
          amount: 2500,
          currency: 'GBP',
          captureMode: 'manual',
        },
        testTenant
      );
      expect(payment.status).toBe('authorized');

      // 2. Final picked amount is £21.00 (under ceiling)
      const captured = await PaymentService.capture(payment.paymentId, 2100, testTenant);

      expect(captured.status).toBe('captured');
      expect(captured.capturedAmount).toBe(2100);
      expect(captured.residualHoldAmount).toBe(400); // £4.00 residual released

      // 3. Verify projection updated in Firestore
      const proj = await FirestorePlatformService.getPaymentProjection(payment.paymentId);
      expect(proj?.status).toBe('captured');
      expect(proj?.capturedAmount.amount).toBe(2100);
      expect(proj?.residualHoldAmount?.amount).toBe(400);
    });

    it('validates CapturePaymentSchema correctly', () => {
      const valid = CapturePaymentSchema.safeParse({ finalAmountMinor: 2100 });
      expect(valid.success).toBe(true);

      const invalidFloat = CapturePaymentSchema.safeParse({ finalAmountMinor: 21.5 });
      expect(invalidFloat.success).toBe(false);
    });
  });

  // ========================================================
  // PAY-08: Final Amount Exceeding Ceiling & Reauthorization Flow
  // ========================================================
  describe('PAY-08: Capture Exceeding Ceiling & Reauthorization Verification', () => {
    it('fails capture if final amount exceeds authorized ceiling without reauthorization', async () => {
      const payment = await PaymentService.requestPayment(
        {
          channelLinkId: testChannelLinkId,
          mode: { type: 'token', tokenId: 'tok_visa_4242' },
          amount: 2000, // £20.00 ceiling
          currency: 'GBP',
          captureMode: 'manual',
        },
        testTenant
      );

      // Attempting to capture £23.00 (exceeds £20.00 authorized)
      await expect(
        PaymentService.capture(payment.paymentId, 2300, testTenant)
      ).rejects.toThrowError(/exceeds authorized/);
    });

    it('allows capture after explicit reauthorization of additional amount', async () => {
      const payment = await PaymentService.requestPayment(
        {
          channelLinkId: testChannelLinkId,
          mode: { type: 'token', tokenId: 'tok_visa_4242' },
          amount: 2000, // £20.00
          currency: 'GBP',
          captureMode: 'manual',
        },
        testTenant
      );

      // Customer approves additional £4.00 (e.g. higher-priced substitute)
      const reauthorized = await PaymentService.reauthorize(payment.paymentId, 400, testTenant);
      expect(reauthorized.authorizedAmount).toBe(2400);

      // Now capture £23.50 (< £24.00 new authorized amount)
      const captured = await PaymentService.capture(payment.paymentId, 2350, testTenant);
      expect(captured.status).toBe('captured');
      expect(captured.capturedAmount).toBe(2350);
      expect(captured.residualHoldAmount).toBe(50);
    });
  });

  // ========================================================
  // PAY-10: Checkout Integration with Authorized Payment ID
  // ========================================================
  describe('PAY-10: Checkout Attachment & Verification', () => {
    it('retrieves payment status through PaymentService', async () => {
      const payment = await PaymentService.requestPayment(
        {
          channelLinkId: testChannelLinkId,
          mode: { type: 'token', tokenId: 'tok_test' },
          amount: 1800,
          currency: 'GBP',
          captureMode: 'manual',
        },
        testTenant
      );

      const retrieved = await PaymentService.getPayment(payment.paymentId, testTenant);
      expect(retrieved).not.toBeNull();
      expect(retrieved.paymentId).toBe(payment.paymentId);
      expect(retrieved.status).toBe('authorized');
    });

    it('supports refunding captured payments', async () => {
      const payment = await PaymentService.requestPayment(
        {
          channelLinkId: testChannelLinkId,
          mode: { type: 'token', tokenId: 'tok_test' },
          amount: 1500,
          currency: 'GBP',
          captureMode: 'manual',
        },
        testTenant
      );
      await PaymentService.capture(payment.paymentId, 1500, testTenant);

      const refunded = await PaymentService.refund(payment.paymentId, 1500, 'Customer cancellation', testTenant);
      expect(refunded.status).toBe('refunded');

      const proj = await FirestorePlatformService.getPaymentProjection(payment.paymentId);
      expect(proj?.status).toBe('refunded');
    });
  });

  // ========================================================
  // DV-05 & DV-06: Production Staging Contract Protection
  // ========================================================
  describe('DV-05, DV-06 & Staging Isolation (No Mock Fallback)', () => {
    it('keeps only unresolved DPay settlement operations guarded', async () => {
      const liveAdapter = new DeliverectDPayAdapter(testTenant);

      // Gateway discovery, payment request, payment lookup and refund now use
      // published Deliverect Pay contracts. Manual final capture remains absent
      // from the public endpoint index, and re-authorisation amount semantics
      // still require partner confirmation.
      await expect(
        liveAdapter.capture('dpay_123', 2000)
      ).rejects.toThrowError(/manual capture/i);

      await expect(
        liveAdapter.reauthorize('dpay_123', 500)
      ).rejects.toThrowError(/amount semantics/i);
    });

    it('IntegrationUnavailableDPayAdapter returns 503 INTEGRATION_NOT_CONFIGURED in staging/production without credentials', async () => {
      const unavail = new IntegrationUnavailableDPayAdapter();
      setDPayAdapter(unavail);

      await expect(
        PaymentService.getPaymentGateways(testChannelLinkId, testTenant)
      ).rejects.toThrowError(/Deliverect Pay integration is not configured/);

      await expect(
        PaymentService.requestPayment(
          {
            channelLinkId: testChannelLinkId,
            mode: { type: 'token', tokenId: 'tok_123' },
            amount: 1000,
            currency: 'GBP',
            captureMode: 'manual',
          },
          testTenant
        )
      ).rejects.toThrowError(/Deliverect Pay integration is not configured/);
    });
  });
});
