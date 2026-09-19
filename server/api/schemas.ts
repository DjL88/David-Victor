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

export const UpdateBasketCustomerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  notes: z.string().optional(),
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
    fulfillmentType: z.enum(['delivery', 'collection']).optional(),
    substitutionPolicy: z.any().optional(),
    scheduledSlot: z.any().optional(),
    paymentMethod: z.any().optional(),
    paymentId: z.string().optional(),
    dispatchValidationId: z.string().optional(),
    dispatchValidationExpiresAt: z.string().optional(),
    idempotencyKey: z.string().optional(),
    channelOrderReference: z.string().optional(),
  })
  .passthrough();

export const PaymentGatewaysQuerySchema = z.object({
  channelLinkId: z.string().min(1, 'channelLinkId is required'),
});

export const DPayRequestPaymentSchema = z.object({
  channelLinkId: z.string().min(1, 'channelLinkId is required'),
  gatewayProfileId: z.string().optional(),
  mode: z.object({
    type: z.enum(['token', 'card', 'hosted']),
    tokenId: z.string().min(1, 'tokenId is required for tokenized payments'),
  }),
  captureMode: z.enum(['manual', 'automatic']).default('manual'),
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

export const CreateTenantSchema = z.object({
  brandName: z.string().min(1, 'brandName is required'),
  tenantId: z.string().optional(),
  domain: z.string().optional(),
  initialAdminEmail: z.string().email().optional(),
  adminEmail: z.string().email().optional(),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  iconUrl: z.string().optional(),
  primaryColour: z.string().optional(),
  secondaryColour: z.string().optional(),
  backgroundColour: z.string().optional(),
  textColour: z.string().optional(),
  fontFamily: z.string().optional(),
  borderRadius: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  currencySymbol: z.string().optional(),
  locale: z.string().optional(),
  supportDetails: z.record(z.string(), z.any()).optional(),
  featureFlags: z.record(z.string(), z.any()).optional(),
});

export const UpdateTenantConfigSchema = z.record(z.string(), z.any());

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
  })
  .passthrough();

export const ReorderHeroBannersSchema = z
  .object({
    banners: z.array(SaveHeroBannerSchema).min(1, 'Banners array is required'),
  })
  .passthrough();

export const UpdateIntegrationSchema = z.object({
  deliverectAccountId: z.string().optional(),
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
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'),
  environment: z.enum(['staging', 'production']).optional(),
  deliverectAccountId: z.string().optional(),
  channelLinkId: z.string().optional(),
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
