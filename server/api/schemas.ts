import { z } from 'zod';

export const ResolveLocationSchema = z.object({
  query: z.string().min(1, 'Location query is required'),
});

export const AddressSchema = z.object({
  street: z.string().optional(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  formattedAddress: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const SearchStoresSchema = z.object({
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  address: z.union([z.string(), AddressSchema]).optional(),
  preferredFulfillment: z.enum(['delivery', 'pickup']).optional(),
});

export const SearchCatalogSchema = z.object({
  query: z.string().optional(),
  storeId: z.string().optional(),
  categoryId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const CreateBasketSchema = z.object({
  storeId: z.string().min(1, 'storeId is required'),
  fulfillmentType: z.enum(['delivery', 'pickup']).optional(),
});

export const UpdateBasketItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z.number().int().min(0, 'quantity must be non-negative'),
});

export const BasketItemUpdateSchema = z.object({
  plu: z.string().optional(),
  productId: z.string().optional(),
  menuId: z.string().optional(),
  quantity: z.number().int().min(0, 'quantity must be non-negative'),
  substitutionPreference: z.any().optional(),
  substituteCandidatePlus: z.array(z.string()).optional(),
  preferredSubstitutePlu: z.string().optional(),
  preferredSubstituteName: z.string().optional(),
  preferredSubstitutePrice: z.any().optional(),
}).refine((data) => !!(data.plu || data.productId), {
  message: 'Either plu or productId must be provided',
});

export const UpdateBasketItemsSchema = z.object({
  items: z.array(BasketItemUpdateSchema).optional(),
  plu: z.string().optional(),
  productId: z.string().optional(),
  menuId: z.string().optional(),
  quantity: z.number().int().min(0).optional(),
  substitutionPreference: z.any().optional(),
  substituteCandidatePlus: z.array(z.string()).optional(),
  preferredSubstitutePlu: z.string().optional(),
  preferredSubstituteName: z.string().optional(),
  preferredSubstitutePrice: z.any().optional(),
});

export const AddBasketBundleSchema = z
  .object({
    bundleId: z.string().min(1).optional(),
    bundlePlu: z.string().min(1).optional(),
    quantity: z.number().int().min(1).max(99).optional().default(1),
    claimExistingBasketItems: z.boolean().optional().default(false),
    selections: z
      .array(
        z.object({
          sectionId: z.string().min(1),
          modifierId: z.string().min(1),
          quantity: z.number().int().min(1).max(99),
        })
      )
      .min(1),
  })
  .refine((value) => Boolean(value.bundleId || value.bundlePlu), {
    message: 'bundleId or bundlePlu is required',
  });

export const UpdateBasketItemSubstitutionSchema = z.object({
  preference: z.enum([
    'BEST_MATCH',
    'CUSTOMER_SELECTED',
    'REMOVE_IF_UNAVAILABLE',
    'CANCEL_ORDER_IF_UNAVAILABLE',
    'DO_NOT_SUBSTITUTE',
  ]),
  substituteCandidatePlus: z.array(z.string()).optional(),
  preferredSubstitutePlu: z.string().optional(),
  preferredSubstituteName: z.string().optional(),
  preferredSubstitutePrice: z
    .object({
      amount: z.number().int().min(0),
      currency: z.string().min(1),
      fractionalDigits: z.number().int().min(0).max(6).optional(),
    })
    .optional(),
});

export const UpdateBasketCustomerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  notes: z.string().optional(),
});

export const CustomerFavouritesSchema = z.object({
  favouritePlus: z.array(z.string().trim().min(1).max(128)).max(500),
});

export const UpdateBasketFulfillmentSchema = z.object({
  fulfillmentType: z.enum(['delivery', 'pickup']).optional(),
  type: z.enum(['delivery', 'pickup']).optional(),
  address: z.union([z.string(), AddressSchema]).optional(),
  deliveryAddress: z.union([z.string(), AddressSchema]).optional(),
  slot: z.any().optional(),
  fulfillmentSlot: z.any().optional(),
  slotId: z.string().optional(),
});

export const UpdateBasketStoreSchema = z.object({
  storeId: z.string().min(1, 'storeId is required'),
  confirmMigration: z.boolean().optional(),
});

export const UpdateBasketDiscountsSchema = z.object({
  code: z.string().optional(),
  remove: z.boolean().optional(),
  discounts: z.array(z.any()).optional(),
});

export const UpdateBasketChargesSchema = z.object({
  charges: z.array(z.any()),
});

export const UpdateBasketTipSchema = z.object({
  tip: z.union([
    z.number().min(0),
    z.object({
      amount: z.number().int().min(0),
      currency: z.string(),
    }),
  ]),
});

export const ValidateBasketSchema = z.object({
  basketId: z.string().optional(),
});

export const ReconcileBasketSchema = z.object({
  basketId: z.string().optional(),
  destinationStoreId: z.string().optional(),
});

export const DeliveryOptionsSchema = z.object({
  basketId: z.string().min(1, 'basketId is required'),
  address: z.union([z.string(), AddressSchema]).optional(),
  fulfillmentType: z.string().optional(),
});

export const DeliverySlotsSchema = z.object({
  storeId: z.string().min(1, 'storeId is required'),
  fulfillmentType: z.string().optional(),
});

export const PaymentSessionSchema = z.object({
  basketId: z.string().min(1, 'basketId is required'),
  returnUrl: z.string().optional(),
});

export const ValidateDispatchSchema = z.object({
  channelLinkId: z.string().optional(),
  storeId: z.string().optional(),
  deliveryAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional(),
    formattedAddress: z.string().optional(),
    coordinates: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .optional(),
  }),
  pickupTime: z.string().optional(),
  deliveryTime: z.string().optional(),
  orderValueMinorUnits: z.number().optional(),
  currency: z.string().optional(),
  itemsCount: z.number().optional(),
});

export const CheckoutBasketOptionsSchema = z
  .object({
    customerName: z.string().optional(),
    customerEmail: z.string().email('Invalid customer email').optional(),
    customerPhone: z.string().optional(),
    deliveryAddress: z.any().optional(),
    fulfillmentType: z.enum(['delivery', 'pickup', 'collection']).optional(),
    substitutionPolicy: z.any().optional(),
    scheduledSlot: z.any().optional(),
    paymentMethod: z.any().optional(),
    paymentTokenRef: z.string().min(1).optional(),
    paymentId: z.string().optional(),
    orderRoute: z.enum(['retail_quest', 'commerce_checkout']).optional(),
    authorizedMaximum: z
      .object({
        amount: z.number().int().nonnegative(),
        currency: z.string().length(3),
      })
      .optional(),
    dispatchValidationId: z.string().optional(),
    dispatchValidationExpiresAt: z.string().optional(),
    selectedQuoteId: z.string().optional(),
    selectedProviderId: z.string().optional(),
    selectedProviderDisplayName: z.string().optional(),
    requiresAgeCheck: z.boolean().optional(),
    minimumAge: z.number().optional(),
    requiresPin: z.boolean().optional(),
    idempotencyKey: z.string().optional(),
    channelOrderReference: z.string().optional(),
  })
  .passthrough();

export const GetDispatchQuotesSchema = z.object({
  storeId: z.string().optional(),
  channelLinkId: z.string().optional(),
  deliveryAddress: z.object({
    postalCode: z.string().optional(),
    postcode: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    formattedAddress: z.string().optional(),
    coordinates: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .optional(),
  }),
  itemsCount: z.number().optional(),
  orderValueMinorUnits: z.number().optional(),
  currency: z.string().optional(),
  requiresAgeCheck: z.boolean().optional(),
  minimumAge: z.number().optional(),
  policy: z.enum(['CUSTOMER_CHOICE', 'CHEAPEST', 'FASTEST', 'TENANT_PRIORITY']).optional(),
  allowedProviders: z.array(z.string()).optional(),
});

export const AssignDispatchSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  idempotencyKey: z.string().optional(),
  force: z.boolean().optional(),
});

export const CancelDispatchSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  reason: z.string().optional(),
});

export const VisualRuleMatchConditionSchema = z.object({
  field: z.enum(['productTag', 'category', 'brand', 'ruleGroup', 'isAlcohol', 'plu']),
  operator: z.enum(['equals', 'contains', 'in']),
  value: z.string().trim().min(1, 'Condition value is required').max(500),
});

export const VisualRuleActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MINIMUM_AGE'), minimumAge: z.number().int().min(1).max(100), requiresGate: z.boolean().optional(), requiresAcknowledgement: z.boolean().optional(), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('PREVENT_UPSELL'), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('PREVENT_RECOMMENDATION'), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('EXCLUDE_FROM_DISCOUNTS'), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('PREVENT_STORY_PLACEMENT'), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('PREVENT_CAROUSEL_PLACEMENT'), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('PREVENT_PURCHASE'), reason: z.string().max(500).optional(), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('HIDE_PRODUCT'), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('MAX_QUANTITY_PER_ORDER'), maximum: z.number().int().min(1).max(9999), reason: z.string().max(500).optional(), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('COMBINED_GROUP_LIMIT'), groupId: z.string().trim().min(1).max(128), maximum: z.number().int().min(1).max(9999), groupName: z.string().max(200).optional(), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('REQUIRES_COURIER_VERIFICATION'), verificationType: z.string().max(100).optional(), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('REQUIRES_ALLERGEN_DISPLAY'), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('BADGE'), label: z.string().trim().min(1).max(80), localizationKey: z.string().max(200).optional(), params: z.record(z.string(), z.unknown()).optional() }),
  z.object({ type: z.literal('WARNING'), text: z.string().trim().min(1).max(500), params: z.record(z.string(), z.unknown()).optional() }),
]);

export const SaveVisualRuleSchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(200),
  enabled: z.boolean(),
  // Was hard-coded to exactly 2 characters (ISO country codes only). Rules can
  // now also scope by UK nation/region/county (e.g. "England", "Essex"),
  // derived from real store geography — see geographyService.ts.
  countries: z.array(z.string().trim().min(2).max(60).transform((v) => v.toUpperCase())).max(50),
  priority: z.number().int().min(-100000).max(100000),
  matchConditions: z.array(VisualRuleMatchConditionSchema).min(1).max(25),
  actions: z.array(VisualRuleActionSchema).min(1).max(25),
}).strict();

export const UpdateTenantDispatchRulesSchema = z.object({
  assignmentEvent: z.enum(['START_PICKING', 'CHECKOUT_PAID', 'ORDER_FINALISED']).optional(),
  dynamicTiming: z.boolean().optional(),
  itemsPickedPerMinute: z.number().min(0.5).max(30).optional(),
  readyBufferMinutes: z.number().min(0).max(120).optional(),
  retryIntervalSeconds: z.number().min(10).max(600).optional(),
  maxRetryAttempts: z.number().min(1).max(10).optional(),
  unacceptedTimeoutMinutes: z.number().min(1).max(120).optional(),
  selectionPolicy: z.enum(['CUSTOMER_CHOICE', 'CHEAPEST', 'FASTEST', 'TENANT_PRIORITY']).optional(),
  allowedProviders: z.array(z.string()).optional(),
});

export const PaymentGatewaysQuerySchema = z.object({
  channelLinkId: z.string().min(1, 'channelLinkId is required'),
});

export const CreatePaymentTokenSchema = z.object({
  gatewayProfileId: z.string().trim().min(1),
  channelLinkId: z.string().trim().min(1),
  customerId: z.string().trim().min(1),
  payment_method: z.object({
    number: z.string().regex(/^\d{12,19}$/, 'Card number must contain digits only'),
    exp_month: z.number().int().min(1).max(12),
    exp_year: z.number().int().min(new Date().getUTCFullYear()).max(new Date().getUTCFullYear() + 30),
    cvc: z.string().regex(/^\d{3,4}$/),
    name: z.string().trim().min(1).max(200).optional(),
  }).strict(),
}).strict();

export const DPayRequestPaymentSchema = z.object({
  channelLinkId: z.string().min(1, 'channelLinkId is required'),
  gatewayProfileId: z.string().optional(),
  mode: z.object({
    type: z.enum(['token', 'card', 'hosted']),
    tokenId: z.string().min(1, 'tokenId is required for tokenized payments'),
  }),
  captureMode: z.enum(['manual', 'immediate']).default('manual'),
  amount: z.number().int('amount must be an integer in minor units').positive('amount must be positive'),
  currency: z.string().length(3, 'currency must be a 3-letter ISO-4217 code'),
  payer: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  orderReference: z.string().optional(),
  basketId: z.string().optional(),
  customerApprovedMaxAmount: z
    .object({
      amount: z.number().int().nonnegative(),
      currency: z.string().length(3),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const CapturePaymentSchema = z.object({
  finalAmountMinor: z.number().int('finalAmountMinor must be an integer').nonnegative('finalAmountMinor must be non-negative'),
});

export const RefundPaymentSchema = z.object({
  refundAmountMinor: z.number().int('refundAmountMinor must be an integer').positive('refundAmountMinor must be positive'),
  reason: z.string().optional(),
});

export const ReauthorizePaymentSchema = z.object({
  additionalAmountMinor: z.number().int('additionalAmountMinor must be an integer').positive('additionalAmountMinor must be positive'),
});

export const CalculateCeilingSchema = z.object({
  reconciledBasketTotal: z.object({
    amount: z.number().int().nonnegative(),
    currency: z.string().length(3),
  }),
  approvedSubstituteUplift: z
    .object({
      amount: z.number().int().nonnegative(),
      currency: z.string().length(3),
    })
    .optional(),
  approvedCatchWeightTolerance: z
    .object({
      amount: z.number().int().nonnegative(),
      currency: z.string().length(3),
    })
    .optional(),
  explicitAgreedCharges: z
    .array(
      z.object({
        amount: z.number().int().nonnegative(),
        currency: z.string().length(3),
      })
    )
    .optional(),
  arbitraryBufferPercentage: z.number().optional(),
  safetyBufferPercentage: z.number().optional(),
});


export const CheckoutBasketSchema = z.object({
  basketId: z.string().min(1, 'basketId is required'),
  options: CheckoutBasketOptionsSchema.optional(),
  tenantId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  channelOrderReference: z.string().optional(),
});

export const DeliverectWebhookPayloadSchema = z
  .object({
    eventId: z.string().optional(),
    id: z.string().optional(),
    eventType: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    orderStatus: z.string().optional(),
    orderId: z.string().optional(),
    channelOrderId: z.string().optional(),
    channelOrderReference: z.string().optional(),
    orderReference: z.string().optional(),
    checkoutId: z.string().optional(),
    timestamp: z.string().optional(),
    tenantId: z.string().optional(),
    amendments: z.array(z.any()).optional(),
    items: z.array(z.any()).optional(),
    failureReason: z.string().optional(),
  })
  .passthrough();

const optionalTrimmedText = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().optional()
);

const optionalEmail = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().email('Enter a valid administrator email address').optional()
);

const optionalOrderCodePrefix: z.ZodType<string | undefined> = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z0-9]{2,4}$/.test(value), 'Order prefix must be 2-4 letters or numbers')
    .optional()
);

const RESERVED_TENANT_IDS = new Set([
  'admin', 'api', 'app', 'assets', 'auth', 'cdn', 'dashboard', 'health',
  'internal', 'preview', 'static', 'support', 'www',
]);

const TenantIdSchema = z.string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{2,40}$/, 'tenantId must be 3-41 lowercase letters, numbers or hyphens')
  .refine((value) => !RESERVED_TENANT_IDS.has(value), 'tenantId is reserved by the platform');

export const CreateTenantSchema = z.object({
  brandName: z.string().trim().min(1, 'brandName is required'),
  tenantId: TenantIdSchema.optional(),
  domain: optionalTrimmedText,
  initialAdminEmail: optionalEmail,
  adminEmail: optionalEmail,
  adminName: optionalTrimmedText,
  tagline: optionalTrimmedText,
  logoUrl: optionalTrimmedText,
  iconUrl: optionalTrimmedText,
  primaryColour: optionalTrimmedText,
  secondaryColour: optionalTrimmedText,
  backgroundColour: optionalTrimmedText,
  textColour: optionalTrimmedText,
  fontFamily: optionalTrimmedText,
  headingFontFamily: optionalTrimmedText,
  borderRadius: optionalTrimmedText,
  country: optionalTrimmedText,
  currency: optionalTrimmedText,
  currencySymbol: optionalTrimmedText,
  locale: optionalTrimmedText,
  orderCodePrefix: optionalOrderCodePrefix,
  paymentPolicy: z.object({
    allowUnpaidOrders: z.boolean().optional(),
    hostedRedirectAllowedOrigins: z.array(z.string().url()).max(25).optional(),
  }).strict().optional(),
  supportDetails: z.record(z.string(), z.any()).optional(),
  featureFlags: z.record(z.string(), z.any()).optional(),
});

export const UpdateTenantConfigSchema = z.object({
  brandName: z.string().trim().min(1).optional(),
  tagline: optionalTrimmedText,
  logoUrl: optionalTrimmedText,
  iconUrl: optionalTrimmedText,
  faviconUrl: optionalTrimmedText,
  headerLogoMode: z.enum(['ICON_WITH_TEXT', 'WIDE_LOGO', 'LOGO_ONLY']).optional(),
  headerLogoMaxWidth: z.number().positive().max(2000).optional(),
  primaryColour: optionalTrimmedText,
  secondaryColour: optionalTrimmedText,
  backgroundColour: optionalTrimmedText,
  textColour: optionalTrimmedText,
  fontFamily: optionalTrimmedText,
  headingFontFamily: optionalTrimmedText,
  carouselTitleFontFamily: optionalTrimmedText,
  surfaceColour: optionalTrimmedText,
  mutedTextColour: optionalTrimmedText,
  borderColour: optionalTrimmedText,
  successColour: optionalTrimmedText,
  warningColour: optionalTrimmedText,
  errorColour: optionalTrimmedText,
  borderRadius: optionalTrimmedText,
  country: optionalTrimmedText,
  currency: optionalTrimmedText,
  currencySymbol: optionalTrimmedText,
  locale: optionalTrimmedText,
  legalName: optionalTrimmedText,
  legalAddress: optionalTrimmedText,
  vatRegistrationNumber: optionalTrimmedText,
  orderCodePrefix: optionalOrderCodePrefix,
  paymentPolicy: z.object({
    allowUnpaidOrders: z.boolean().optional(),
    hostedRedirectAllowedOrigins: z.array(z.string().url()).max(25).optional(),
  }).strict().optional(),
  enabledLocales: z.array(z.string().trim().min(2).max(35)).max(50).optional(),
  copyOverrides: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  supportDetails: z.record(z.string(), z.any()).optional(),
  featureFlags: z.record(z.string(), z.any()).optional(),
}).strict();

const MarketingScheduleSchema = z.object({
  startsAt: z.string().optional(), endsAt: z.string().optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).optional(),
  dailyStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  dailyEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
}).optional();

export const UpdateFeePolicySchema = z
  .object({
    deliveryFee: z.number().min(0, 'deliveryFee must be non-negative').optional(),
    freeDeliveryThreshold: z.number().min(0).optional(),
    smallOrderFeeEnabled: z.boolean().optional(),
    smallOrderThreshold: z.number().min(0).optional(),
    smallOrderFee: z.number().min(0).optional(),
    serviceFeeEnabled: z.boolean().optional(),
    serviceFeePercentage: z.number().min(0).max(100).optional(),
    bagFeeEnabled: z.boolean().optional(),
    bagFeeAmount: z.number().min(0).optional(),
    drsFeeEnabled: z.boolean().optional(),
    drsFeeAmount: z.number().min(0).optional(),
  })
  .passthrough();

export const UpdateSchedulingPolicySchema = z
  .object({
    acceptAsapOrdersOnly: z.boolean().optional(),
    allowNextOpeningPreOrder: z.boolean().optional(),
    allowSameDayScheduledPreOrder: z.boolean().optional(),
  })
  .passthrough();

export const SaveStorySchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(1, 'Story title is required'),
    author: z.string().optional(),
    avatarUrl: z.string().optional(),
    tag: z.string().optional(),
    badge: z.string().optional(),
    mediaType: z.enum(['image', 'video']).optional(),
    mediaUrl: z.string().optional(),
    previewUrl: z.string().optional(),
    durationSeconds: z.number().optional(),
    orderIndex: z.number().optional(),
    isActive: z.boolean().optional(),
    published: z.boolean().optional(),
    schedule: MarketingScheduleSchema,
    linkedCategory: z.string().optional(),
    linkedProducts: z.array(z.string()).optional(),
    linkedProductPlus: z.array(z.string()).optional(),
    targetStoreIds: z.array(z.string()).optional(),
    storeIds: z.array(z.string()).optional(),
    eligibleStoreIds: z.array(z.string()).optional(),
    stockMatchMode: z.enum(['AND', 'OR']).optional(),
    items: z
      .array(
        z
          .object({
            id: z.string().optional(),
            mediaUrl: z.string().optional(),
            mediaType: z.string().optional(),
            caption: z.string().optional(),
            duration: z.number().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export const SaveHeroBannerSchema = z
  .object({
    id: z.string().min(1, 'Banner ID is required'),
    title: z.string().min(1, 'Banner title is required'),
    subtitle: z.string().optional(),
    badge: z.string().optional(),
    backgroundImageUrl: z.string().min(1, 'Background image is required'),
    buttonLabel: z.string().min(1, 'Button label is required'),
    actionType: z.enum(['CATEGORY', 'PRODUCT', 'SEARCH', 'STORE_PICKER']).optional(),
    targetPlu: z.string().optional(),
    targetCategoryId: z.string().optional(),
    categoryId: z.string().optional(),
    categorySlugMatch: z.string().optional(),
    linkedProductPlus: z.array(z.string()).optional(),
    stockMatchMode: z.enum(['AND', 'OR']).optional(),
    searchQuery: z.string().optional(),
    orderIndex: z.number().optional(),
    schedule: MarketingScheduleSchema,
  })
  .passthrough();

export const ReorderHeroBannersSchema = z
  .object({
    banners: z.array(SaveHeroBannerSchema).min(1, 'Banners array is required'),
  })
  .passthrough();

export const UpdateIntegrationSchema = z.object({
  deliverectAccountId: z.string().optional(),
  channelName: z.string().min(1).optional(),
  orderRoute: z.enum(['retail_quest', 'commerce_checkout']).optional(),
  environment: z.enum(['staging', 'production']).optional(),
  status: z.enum(['connected', 'standalone', 'error']).optional(),
  bffProxyUrl: z.string().optional(),
});

export const TestConnectionSchema = z.object({
  deliverectAccountId: z.string().min(1, 'Deliverect Account ID is required'),
  environment: z.enum(['staging', 'production']).optional(),
  tenantId: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  channelLinkId: z.string().optional(),
});

export const UpdateIntegrationCredentialsSchema = z.object({
  credentialMode: z.enum(['platform', 'dedicated']).default('dedicated'),
  clientId: z.string().trim().optional(),
  clientSecret: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
  environment: z.enum(['staging', 'production']).optional(),
  deliverectAccountId: z.string().optional(),
  channelLinkId: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.credentialMode === 'dedicated') {
    if (!value.clientId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clientId'], message: 'Client ID is required for dedicated credentials' });
    if (!value.clientSecret) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clientSecret'], message: 'Client Secret is required for dedicated credentials' });
  }
});

export const AssetUploadSchema = z.object({
  tenantId: z.string().optional(),
  type: z.string().min(1, 'type is required'),
  fileName: z.string().min(1, 'fileName is required'),
  fileData: z.string().min(1, 'fileData is required'),
  contentType: z.string().optional(),
  byteSize: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const AssetUploadUrlSchema = z.object({
  tenantId: z.string().optional(),
  type: z.string().min(1, 'type is required'),
  fileName: z.string().min(1, 'fileName is required'),
  contentType: z.string().min(1, 'contentType is required'),
  byteSize: z.number().optional(),
});

export const AssetFinalizeSchema = z.object({
  tenantId: z.string().optional(),
  assetId: z.string().min(1, 'assetId is required'),
});

export const BrandProfileAnalyseSchema = z.object({
  tenantId: z.string().optional(),
  assetId: z.string().min(1, 'assetId is required'),
}).strict();


const AdminAssistantAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(100).optional(),
  content: z.string().max(24000),
  byteSize: z.number().nonnegative().max(5_000_000).optional(),
  truncated: z.boolean().optional(),
}).strict();

export const AdminAssistantChatSchema = z.object({
  message: z.string().trim().max(4000).default(''),
  attachments: z.array(AdminAssistantAttachmentSchema).max(3).optional().default([]),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().max(4000).default(''),
    attachments: z.array(AdminAssistantAttachmentSchema).max(3).optional().default([]),
  }).strict().refine((value) => Boolean(value.content || value.attachments.length), {
    message: 'Chat history messages require text or an attachment.',
  })).max(12).optional().default([]),
  context: z.object({
    section: z.string().min(1).max(100).optional(),
    resourceType: z.string().min(1).max(100).optional(),
    resourceId: z.string().min(1).max(500).optional(),
    organizationId: z.string().min(1).max(200).optional(),
    market: z.string().min(1).max(200).optional(),
    region: z.string().min(1).max(200).optional(),
    locationGroupId: z.string().min(1).max(200).optional(),
    locationId: z.string().min(1).max(200).optional(),
  }).strict().optional(),
}).strict().refine((value) => Boolean(value.message || value.attachments.length), {
  message: 'A message or attachment is required.',
});

export const AdminAssistantPlanSchema = z.object({
  actionName: z.string().min(1).max(100),
  input: z.record(z.string(), z.unknown()).optional().default({}),
  context: z.object({
    section: z.string().min(1).max(100).optional(),
    resourceType: z.string().min(1).max(100).optional(),
    resourceId: z.string().min(1).max(500).optional(),
    organizationId: z.string().min(1).max(200).optional(),
    market: z.string().min(1).max(200).optional(),
    region: z.string().min(1).max(200).optional(),
    locationGroupId: z.string().min(1).max(200).optional(),
    locationId: z.string().min(1).max(200).optional(),
  }).optional(),
});

export const AdminAssistantExecuteSchema = z.object({
  planId: z.string().min(1).max(200),
  confirmationToken: z.string().min(1).max(500).optional(),
});

export const AdminAssistantChangeSetSchema = z.object({
  prompt: z.string().trim().min(1).max(8000).optional(),
  actions: z.array(z.object({
    actionName: z.string().min(1).max(100),
    input: z.record(z.string(), z.unknown()).optional().default({}),
  })).min(1).max(50),
  idempotencyKey: z.string().min(1).max(200).optional(),
  conversationId: z.string().min(1).max(200).optional(),
}).strict();
