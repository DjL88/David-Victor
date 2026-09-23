/**
 * Central Internationalisation Dictionary
 * Contains typed keys for navigation, basket, checkout, substitutions,
 * Quest order states, errors, and system notices.
 */

export interface LocaleTranslations {
  // Navigation
  'nav.home': string;
  'nav.search': string;
  'nav.orders': string;
  'nav.account': string;
  'nav.aisles': string;
  'nav.favourites': string;
  'nav.buyAgain': string;
  'nav.admin': string;

  // Header & Stores
  'header.deliveringTo': string;
  'header.collectFrom': string;
  'header.changeLocation': string;
  'header.selectStore': string;
  'header.openStores': string;
  'header.closedStoreNotice': string;
  'header.acceptsPreOrders': string;
  'header.setLocation': string;
  'header.allStores': string;
  'header.delivery': string;
  'header.collect': string;
  'header.deliveryOnly': string;
  'header.profilePreferences': string;
  'header.ordersTracking': string;
  'header.basket': string;

  // Fulfilment & Location
  'fulfilment.title': string;
  'fulfilment.subtitle': string;
  'fulfilment.deliverTo': string;
  'fulfilment.delivery': string;
  'fulfilment.collection': string;
  'fulfilment.comingSoon': string;
  'fulfilment.available': string;
  'fulfilment.limitedZone': string;
  'fulfilment.notAvailableYet': string;
  'fulfilment.storeDelivers': string;
  'fulfilment.storesDeliver': string;
  'fulfilment.collectionAvailable': string;
  'fulfilment.free': string;
  'fulfilment.localBranch': string;
  'fulfilment.localBranches': string;
  'location.deliveryAddress': string;
  'location.liveRouting': string;
  'location.map': string;
  'location.list': string;
  'location.selectedLocation': string;
  'location.hideMap': string;
  'location.showMap': string;
  'location.locating': string;
  'location.useCurrentLocation': string;
  'location.savedAddresses': string;
  'location.confirmContinue': string;

  // Account
  'account.languageRegion': string;
  'account.savedAddresses': string;
  'account.paymentMethods': string;
  'account.notifications': string;
  'account.brandInfoPolicies': string;
  'account.signIn': string;
  'account.signOut': string;
  'account.notSignedIn': string;
  'account.verifiedAccount': string;
  'account.guestSession': string;
  'account.customerSupport': string;
  'account.supportEmailMissing': string;
  'account.supportPhoneMissing': string;
  'account.supportHours': string;
  'account.supportHoursFallback': string;
  'account.operationsPortal': string;
  'account.operationsPortalDescription': string;
  'account.launchAdmin': string;
  'account.signInToManage': string;
  'account.noSavedAddresses': string;
  'account.paymentProviderNote': string;
  'account.notificationNote': string;
  'account.noPolicies': string;

  // Basket & Checkout
  'basket.title': string;
  'basket.emptyTitle': string;
  'basket.emptySubtitle': string;
  'basket.startShopping': string;
  'basket.subtotal': string;
  'basket.deliveryFee': string;
  'basket.serviceFee': string;
  'basket.bagFee': string;
  'basket.deposit': string;
  'basket.discount': string;
  'basket.tip': string;
  'basket.total': string;
  'basket.checkoutBtn': string;
  'basket.clearBasket': string;
  'basket.youMayHaveForgotten': string;
  'basket.saving': string;
  'basket.selectedStore': string;
  'basket.unavailableAtStore': string;
  'basket.swapAllInStock': string;
  'basket.stockCheckNotice': string;
  'basket.comboDeal': string;
  'basket.quantityUnavailable': string;
  'basket.snoozedByStore': string;
  'basket.unavailableHere': string;
  'basket.each': string;
  'basket.drsDeposit': string;
  'basket.inStockSubstitute': string;
  'basket.swap': string;
  'basket.ifUnavailable': string;
  'basket.preChosenSubstitute': string;
  'basket.removeItem': string;
  'basket.cancelEntireOrder': string;
  'basket.bestMatch': string;
  'basket.alternativeSelected': string;
  'basket.buffer': string;
  'basket.cancel': string;
  'basket.refund': string;
  'basket.cheapest': string;
  'basket.chooseOne': string;
  'basket.addToCompleteDeal': string;
  'basket.chooseItem': string;
  'basket.addSave': string;
  'basket.completeDeal': string;
  'basket.chooseInStock': string;
  'basket.dealDiscount': string;
  'basket.totalDealSavings': string;
  'basket.totalToPay': string;
  'basket.cardPreAuth': string;
  'basket.estimated': string;
  'basket.preAuthNotice': string;
  'basket.reviewResolve': string;
  'basket.goCheckout': string;
  'basket.hfssTitle': string;
  'basket.hfssNotice': string;
  'basket.item': string;
  'basket.ifItemUnavailable': string;
  'basket.unavailablePreferenceHelp': string;
  'basket.substituteBestMatch': string;
  'basket.cheapestOption': string;
  'basket.bestMatchHelp': string;
  'basket.preChooseSubstitute': string;
  'basket.bufferAdjusted': string;
  'basket.preChooseHelp': string;
  'basket.sameOrCheaper': string;
  'basket.change': string;
  'basket.selectAlternative': string;
  'basket.preAuthBufferUpdate': string;
  'basket.extra': string;
  'basket.bufferNoticeSuffix': string;
  'basket.chooseAlternativeProduct': string;
  'basket.searchAlternatives': string;
  'basket.noPriceDifference': string;
  'basket.removeIfUnavailable': string;
  'basket.autoRefund': string;
  'basket.removeUnavailableHelp': string;
  'basket.cancelIfUnavailable': string;
  'basket.essentialItem': string;
  'basket.cancelUnavailableHelp': string;
  'basket.update': string;

  // Checkout & Pre-Authorization
  'checkout.title': string;
  'checkout.scheduling': string;
  'checkout.asap': string;
  'checkout.scheduled': string;
  'checkout.selectSlot': string;
  'checkout.substitutionPreferences': string;
  'checkout.subBestMatch': string;
  'checkout.subCustomerSelected': string;
  'checkout.subDoNotSubstitute': string;
  'checkout.subRemoveUnavailable': string;
  'checkout.subCancelOrder': string;
  'checkout.lowerPriceGuarantee': string;
  'checkout.authNoticeTitle': string;
  'checkout.authNoticeDesc': string;
  'checkout.authorizeAndSubmit': string;
  'checkout.authorizing': string;
  'checkout.noRawCardExposure': string;
  'checkout.orderTracking': string;
  'checkout.hostedCheckout': string;
  'checkout.confirmingOrder': string;
  'checkout.secureCheckout': string;
  'checkout.deliveryAddress': string;
  'checkout.noDeliveryAddress': string;
  'checkout.fulfillmentMethod': string;
  'checkout.inStoreCollection': string;
  'checkout.selectedStore': string;
  'checkout.fulfillingStore': string;
  'checkout.immediatePriority': string;
  'checkout.preOrderSlot': string;
  'checkout.asapCollection': string;
  'checkout.asapDelivery': string;
  'checkout.scheduledSlot': string;
  'checkout.selectDateTime': string;
  'checkout.selectReservationWindow': string;
  'checkout.bestMatchGuarantee': string;
  'checkout.chooseOutOfStock': string;
  'checkout.contactDetails': string;
  'checkout.contactDetailsHelp': string;
  'checkout.name': string;
  'checkout.email': string;
  'checkout.phone': string;
  'checkout.namePlaceholder': string;
  'checkout.tipCourier': string;
  'checkout.none': string;
  'checkout.promoCode': string;
  'checkout.promoPlaceholder': string;
  'checkout.apply': string;
  'checkout.applying': string;
  'checkout.payableTotal': string;
  'checkout.collectionOrder': string;
  'checkout.collectionNotice': string;
  'checkout.paymentModel': string;
  'checkout.placingCollection': string;
  'checkout.resolveStock': string;
  'checkout.collectionIssue': string;
  'checkout.dispatchUnavailable': string;
  'checkout.placeCollection': string;
  'checkout.hostedPayAlternative': string;
  'checkout.collectionNoPayment': string;
  'checkout.secureCardNotice': string;
  'checkout.hostedSession': string;
  'checkout.processingOrder': string;
  'checkout.orderConfirmed': string;
  'checkout.loadingTracking': string;
  'checkout.closeConfirmed': string;
  'checkout.amountDue': string;
  'checkout.supportedWallets': string;
  'checkout.completePayment': string;
  'checkout.cancelReturn': string;

  // Order & Picking States
  'order.statusAccepted': string;
  'order.statusPicking': string;
  'order.statusPickingWithChanges': string;
  'order.statusPaymentFinalising': string;
  'order.statusReadyCourier': string;
  'order.statusCourierAssigned': string;
  'order.statusCourierAtStore': string;
  'order.statusOutForDelivery': string;
  'order.statusDelivered': string;
  'order.statusCancelled': string;
  'order.itemPicked': string;
  'order.itemSubstituted': string;
  'order.itemQuantityAmended': string;
  'order.itemRemoved': string;
  'order.reauthorizeRequired': string;
  'order.approveReauth': string;

  // Product detail
  'product.closeDetails': string;
  'product.noImage': string;
  'product.includesDeposit': string;
  'product.caloriesEnergy': string;
  'product.fat': string;
  'product.carbs': string;
  'product.protein': string;
  'product.sugars': string;
  'product.salt': string;
  'product.netQuantity': string;
  'product.storageInstructions': string;
  'product.manufacturerOrigin': string;
  'product.manufacturer': string;
  'product.countryOrigin': string;
  'product.alcoholDetails': string;
  'product.legalNotice': string;
  'product.age18Notice': string;
  'product.depositScheme': string;
  'product.depositNotice': string;
  'product.total': string;
  'product.chooseStore': string;
  'product.addToBasket': string;
  'product.specialOffer': string;
  'product.priceUnavailable': string;
  'product.outOfStockNearby': string;
  'product.availableAllStores': string;
  'product.availableSomeStores': string;
  'product.compareStores': string;
  'product.description': string;
  'product.allergenInformation': string;
  'product.ingredients': string;
  'product.nutritionalValues': string;
  'product.dietaryLifestyle': string;
  'product.outOfStock': string;

  // Orders list
  'orders.title': string;
  'orders.refresh': string;
  'orders.recentActivity': string;
  'orders.noActive': string;
  'orders.emptyLive': string;
  'orders.actionRequired': string;
  'orders.item': string;
  'orders.items': string;
  'orders.withSubstitutions': string;
  'orders.payment': string;
  'orders.pending': string;
  'orders.trackOrder': string;
  'orders.paymentAuthorized': string;
  'orders.paymentCaptured': string;
  'orders.paymentActionRequired': string;
  'orders.paymentTokenized': string;
  'order.statusSubmitted': string;
  'order.statusPickedPacked': string;
  'order.statusReadyCollection': string;

  // Order tracking
  'tracking.allOrders': string;
  'tracking.courierDelivery': string;
  'tracking.storeCollection': string;
  'tracking.scheduled': string;
  'tracking.asapDelivery': string;
  'tracking.finalChargedTotal': string;
  'tracking.orderCancelled': string;
  'tracking.cancelledFallback': string;
  'tracking.paymentHoldReleased': string;
  'tracking.reauthRequired': string;
  'tracking.reauthPrefix': string;
  'tracking.reauthExceeds': string;
  'tracking.reauthSuffix': string;
  'tracking.authorizing': string;
  'tracking.approvePay': string;
  'tracking.lifecycleTitle': string;
  'tracking.lifecycleNotice': string;
  'tracking.pickingItems': string;
  'tracking.timeline': string;
  'tracking.paymentAuthorization': string;
  'tracking.storePickingState': string;
  'tracking.status': string;
  'tracking.substituted': string;
  'tracking.quantityAdjusted': string;
  'tracking.outOfStockRefunded': string;
  'tracking.picked': string;
  'tracking.awaitingPicker': string;
  'tracking.requested': string;
  'tracking.supplied': string;
  'tracking.substitute': string;
  'tracking.shelf': string;
  'tracking.youPay': string;
  'tracking.note': string;
  'tracking.was': string;
  'tracking.paymentBreakdown': string;
  'tracking.originalEstimate': string;
  'tracking.approvedCeiling': string;
  'tracking.deliveryCharge': string;
  'tracking.bagServiceFees': string;
  'tracking.finalCaptured': string;
  'tracking.auditHistory': string;
  'tracking.cardTokenized': string;
  'tracking.preAuthorizedEstimated': string;
  'tracking.actionReauthorize': string;
  'tracking.finalTotalCaptured': string;
  'tracking.pending': string;
  'tracking.by': string;
  'tracking.eta': string;

  // Errors & Fallbacks
  'error.general': string;
  'error.stockDepleted': string;
  'error.noServiceableStore': string;
  'error.paymentDeclined': string;
  'error.mediaFailed': string;

  // Search & Aisles
  'search.placeholder': string;
  'search.trending': string;
  'search.searching': string;
  'search.foundItem': string;
  'search.foundItems': string;
  'search.forQuery': string;
  'search.multiStore': string;
  'search.noResults': string;
  'search.noResultsHint': string;
  'aisles.all': string;
  'aisles.allCategoryPrefix': string;
  'aisles.browsingStore': string;
  'aisles.selectShelf': string;
  'aisles.searchPlaceholder': string;
  'aisles.back': string;
  'aisles.viewAllIn': string;
  'aisles.browseEntire': string;
  'aisles.selected': string;
  'aisles.noMatching': string;
  'aisles.trySearchHint': string;
  'aisles.clearSearch': string;
  'aisles.item': string;
  'aisles.items': string;
  'aisles.searchAisles': string;
  'aisles.parentAisle': string;
  'aisles.more': string;
  'aisles.category': string;
  'aisles.productsSearchPlaceholder': string;

  // Favourites & Buy Again
  'fav.emptyTitle': string;
  'fav.emptySubtitle': string;
  'fav.reorderAll': string;
  'fav.revalidating': string;
  'fav.addedToBasket': string;
}

export const TRANSLATIONS: Record<string, LocaleTranslations> = {
  'en-GB': {
    'nav.home': 'Home',
    'nav.search': 'Search',
    'nav.orders': 'Orders',
    'nav.account': 'Account',
    'nav.aisles': 'Aisles',
    'nav.favourites': 'Favourites',
    'nav.buyAgain': 'Buy Again',
    'nav.admin': 'Admin Console',

    'header.deliveringTo': 'Delivering to',
    'header.collectFrom': 'Collect from',
    'header.changeLocation': 'Change',
    'header.selectStore': 'Select Store',
    'header.openStores': 'Open Stores Nearby',
    'header.closedStoreNotice': 'Currently Closed',
    'header.acceptsPreOrders': 'Pre-ordering open for scheduled delivery',
    'header.setLocation': 'Set Location',
    'header.allStores': 'All Stores',
    'header.delivery': 'Delivery',
    'header.collect': 'Collect',
    'header.deliveryOnly': 'Delivery Only',
    'header.profilePreferences': 'Profile & Preferences',
    'header.ordersTracking': 'Orders & Tracking',
    'header.basket': 'Basket',
    'fulfilment.title': 'How would you like your order?',
    'fulfilment.subtitle': 'Choose delivery to your door or store collection',
    'fulfilment.deliverTo': 'Deliver to',
    'fulfilment.delivery': 'Doorstep Delivery',
    'fulfilment.collection': 'Click & Collect',
    'location.deliveryAddress': 'Delivery Address',
    'location.liveRouting': 'Live distance and routing',
    'location.map': 'Map',
    'location.list': 'List',
    'fulfilment.comingSoon': 'Coming Soon',
    'fulfilment.available': 'Available',
    'fulfilment.limitedZone': 'Limited Zone',
    'fulfilment.notAvailableYet': 'Not available yet — please choose Click & Collect',
    'fulfilment.storeDelivers': 'nearby store delivers to your address',
    'fulfilment.storesDeliver': 'nearby stores deliver to your address',
    'fulfilment.collectionAvailable': 'Collection available from nearby locations',
    'fulfilment.free': 'Free',
    'fulfilment.localBranch': 'local branch',
    'fulfilment.localBranches': 'local branches',
    'location.selectedLocation': 'Selected Location',
    'location.hideMap': 'Hide Map',
    'location.showMap': 'Show Map',
    'location.locating': 'Locating…',
    'location.useCurrentLocation': 'Use Current Location',
    'location.savedAddresses': 'Saved Addresses',
    'location.confirmContinue': 'Confirm & Continue',

    'account.languageRegion': 'Language & Region',
    'account.savedAddresses': 'Saved delivery addresses',
    'account.paymentMethods': 'Payment methods',
    'account.notifications': 'Order notifications & delivery alerts',
    'account.brandInfoPolicies': 'Brand Information & Policies',
    'account.signIn': 'Sign In',
    'account.signOut': 'Sign Out',
    'account.notSignedIn': 'Not signed in',
    'account.verifiedAccount': 'Verified Account',
    'account.guestSession': 'Guest Session',
    'account.customerSupport': 'customer support',
    'account.supportEmailMissing': 'Support email not configured',
    'account.supportPhoneMissing': 'Support phone not configured',
    'account.supportHours': 'Hours',
    'account.supportHoursFallback': 'See store information for opening hours',
    'account.operationsPortal': 'Brand Operations Portal',
    'account.operationsPortalDescription': 'Manage fees, rules, stories, branding & insights',
    'account.launchAdmin': 'Launch Admin',
    'account.signInToManage': 'Sign in to manage settings linked to your account.',
    'account.noSavedAddresses': 'No saved delivery addresses are available for this account yet.',
    'account.paymentProviderNote': 'Payment methods are securely collected during checkout and are not displayed here unless the payment provider exposes a saved method.',
    'account.notificationNote': 'Order updates use the contact details and notification channels available for each order.',
    'account.noPolicies': 'No information or policy pages are published for this language yet.',

    'basket.title': 'Your Basket',
    'basket.emptyTitle': 'Your basket is empty',
    'basket.emptySubtitle': 'Add fresh artisan groceries and local essentials to get started.',
    'basket.startShopping': 'Start Shopping',
    'basket.subtotal': 'Subtotal',
    'basket.deliveryFee': 'Delivery Fee',
    'basket.serviceFee': 'Service & Packaging',
    'basket.bagFee': 'Bag Fee',
    'basket.deposit': 'Bottle Deposit (DRS)',
    'basket.discount': 'Discount',
    'basket.tip': 'Driver Tip',
    'basket.total': 'Estimated Total',
    'basket.checkoutBtn': 'Review & Checkout',
    'basket.clearBasket': 'Clear Basket',
    'basket.youMayHaveForgotten': 'You may have forgotten...',
    'basket.saving': 'Saving',
    'basket.selectedStore': 'Selected Store',
    'basket.unavailableAtStore': 'item(s) unavailable at this store',
    'basket.swapAllInStock': 'Swap All In-Stock',
    'basket.stockCheckNotice': 'Real-time stock check found items that are snoozed or out of stock. You can swap them with in-stock alternatives or remove them.',
    'basket.comboDeal': 'Combo Deal',
    'basket.quantityUnavailable': 'Quantity unavailable',
    'basket.snoozedByStore': 'Snoozed by store',
    'basket.unavailableHere': 'Unavailable at this store',
    'basket.each': 'each',
    'basket.drsDeposit': 'DRS Deposit',
    'basket.inStockSubstitute': 'In-stock substitute',
    'basket.swap': 'Swap',
    'basket.ifUnavailable': 'If unavailable',
    'basket.preChosenSubstitute': 'Pre-chosen substitute',
    'basket.removeItem': 'Remove item',
    'basket.cancelEntireOrder': 'Cancel entire order',
    'basket.bestMatch': 'Best match',
    'basket.alternativeSelected': 'alternative selected',
    'basket.buffer': 'buffer',
    'basket.cancel': 'Cancel',
    'basket.refund': 'Refund',
    'basket.cheapest': 'Cheapest',
    'basket.chooseOne': 'Choose 1',
    'basket.addToCompleteDeal': 'to complete this deal',
    'basket.chooseItem': 'Choose item',
    'basket.addSave': 'Add & save',
    'basket.completeDeal': 'Complete',
    'basket.chooseInStock': 'Choose an in-stock',
    'basket.dealDiscount': 'Deal Discount',
    'basket.totalDealSavings': 'Total Deal Savings Applied',
    'basket.totalToPay': 'Total to Pay',
    'basket.cardPreAuth': 'Card Pre-Authorisation',
    'basket.estimated': 'est.',
    'basket.preAuthNotice': 'Your payment method is authorised for the estimated total. You are only charged for what is confirmed and picked in store; any difference is released immediately.',
    'basket.reviewResolve': 'Review & Resolve Items at Checkout',
    'basket.goCheckout': 'Go to Checkout',
    'basket.hfssTitle': 'UK Food Promotion Compliance (HFSS Protected)',
    'basket.hfssNotice': 'bundle opportunity suppressed from upsell prompts under UK Food Promotion and Placement rules because the candidate item is high in fat, sugar or salt.',
    'basket.item': 'Basket Item',
    'basket.ifItemUnavailable': 'If this item is unavailable',
    'basket.unavailablePreferenceHelp': 'Choose how your store picker should handle this item during picking.',
    'basket.substituteBestMatch': 'Substitute if unavailable (Best match)',
    'basket.cheapestOption': 'Cheapest Option',
    'basket.bestMatchHelp': 'The picker in shop will only swap with the same value or lower. You are guaranteed the lowest price.',
    'basket.preChooseSubstitute': 'Pre-choose substitute',
    'basket.bufferAdjusted': 'Buffer Adjusted',
    'basket.preChooseHelp': 'Select 1 alternative option. If it costs more, the higher value is calculated into the pre-authorisation buffer on your card payment.',
    'basket.sameOrCheaper': 'Same or cheaper',
    'basket.change': 'Change',
    'basket.selectAlternative': 'Select 1 alternative option',
    'basket.preAuthBufferUpdate': 'Pre-auth buffer update',
    'basket.extra': 'Extra',
    'basket.bufferNoticeSuffix': 'will be reserved on your card. If picked, you only pay this higher price; if the original item is available, you pay the original price.',
    'basket.chooseAlternativeProduct': 'Choose Alternative Product',
    'basket.searchAlternatives': 'Search alternatives...',
    'basket.noPriceDifference': 'no price difference',
    'basket.removeIfUnavailable': 'Remove if unavailable',
    'basket.autoRefund': 'Auto Refund',
    'basket.removeUnavailableHelp': 'The picker can only remove this item if unavailable. You will be refunded the full amount.',
    'basket.cancelIfUnavailable': 'Cancel entire order if unavailable',
    'basket.essentialItem': 'Essential Item',
    'basket.cancelUnavailableHelp': 'If this item is unavailable, do not deliver. Your entire order will be cancelled with no charge.',
    'basket.update': 'Update',

    'checkout.title': 'Grocery Checkout & Authorization',
    'checkout.scheduling': 'Fulfillment Timing',
    'checkout.asap': 'ASAP Delivery',
    'checkout.scheduled': 'Scheduled Time Slot',
    'checkout.selectSlot': 'Select a delivery window',
    'checkout.substitutionPreferences': 'Substitution Choices',
    'checkout.subBestMatch': 'Best Match (Store Choice)',
    'checkout.subCustomerSelected': 'Choose Specific Substitute',
    'checkout.subDoNotSubstitute': 'Do Not Substitute',
    'checkout.subRemoveUnavailable': 'Remove If Unavailable',
    'checkout.subCancelOrder': 'Cancel Order If Unavailable',
    'checkout.lowerPriceGuarantee': 'Lower Price Guarantee: if substitute costs more, you only pay original price.',
    'checkout.authNoticeTitle': 'Retail Pre-Authorization Model',
    'checkout.authNoticeDesc': 'You are not charged immediately. We pre-authorize estimated total. Payment is only captured after picking completes in store.',
    'checkout.authorizeAndSubmit': 'Authorize & Place Order',
    'checkout.authorizing': 'Authorizing & Securing Dispatch...',
    'checkout.noRawCardExposure': 'PCI Tokenized • Zero Raw Card Storage',
    'checkout.orderTracking': 'Order Tracking',
    'checkout.hostedCheckout': 'Deliverect Pay Hosted Checkout',
    'checkout.confirmingOrder': 'Confirming Order',
    'checkout.secureCheckout': 'Secure Checkout',
    'checkout.deliveryAddress': 'Delivery Address',
    'checkout.noDeliveryAddress': 'No delivery address provided',
    'checkout.fulfillmentMethod': 'Fulfilment Method',
    'checkout.inStoreCollection': 'In-Store Collection',
    'checkout.selectedStore': 'Selected Store',
    'checkout.fulfillingStore': 'Fulfilling Store',
    'checkout.immediatePriority': 'Immediate Priority',
    'checkout.preOrderSlot': 'Pre-Order Slot',
    'checkout.asapCollection': 'ASAP Collection',
    'checkout.asapDelivery': 'ASAP Delivery',
    'checkout.scheduledSlot': 'Scheduled Slot',
    'checkout.selectDateTime': 'Select date/time',
    'checkout.selectReservationWindow': 'Select reservation window',
    'checkout.bestMatchGuarantee': 'Best-Match Price Guarantee: you always pay the lower price!',
    'checkout.chooseOutOfStock': 'Choose what our in-store shopper should do if an item is out of stock.',
    'checkout.contactDetails': 'Contact details',
    'checkout.contactDetailsHelp': 'Used by the store for this order. Enter a name plus an email address or phone number.',
    'checkout.name': 'Name',
    'checkout.email': 'Email',
    'checkout.phone': 'Phone',
    'checkout.namePlaceholder': 'Name for collection',
    'checkout.tipCourier': 'Tip your courier (100% goes to driver)',
    'checkout.none': 'None',
    'checkout.promoCode': 'Promo or Gift Code',
    'checkout.promoPlaceholder': 'e.g. SAVE5 or FREEDELIV',
    'checkout.apply': 'Apply',
    'checkout.applying': 'Applying…',
    'checkout.payableTotal': 'Payable Total',
    'checkout.collectionOrder': 'Collection Order',
    'checkout.collectionNotice': 'This collection order is submitted directly to the store. No card pre-authorisation, payment capture or courier dispatch is created on this order path.',
    'checkout.paymentModel': 'Retail Grocery Payment Model',
    'checkout.placingCollection': 'Placing Collection Order…',
    'checkout.resolveStock': 'Resolve out-of-stock items above',
    'checkout.collectionIssue': 'Collection order issue — retry above',
    'checkout.dispatchUnavailable': 'Courier dispatch unavailable — retry above',
    'checkout.placeCollection': 'Place Collection Order',
    'checkout.hostedPayAlternative': 'Or use Deliverect Pay Hosted Session',
    'checkout.collectionNoPayment': 'No payment authorisation or courier dispatch for collection',
    'checkout.secureCardNotice': 'Zero raw card exposure • PCI tokenized pre-authorisation',
    'checkout.hostedSession': 'Deliverect Pay Hosted Session',
    'checkout.processingOrder': 'Processing Order',
    'checkout.orderConfirmed': 'Order confirmed',
    'checkout.loadingTracking': 'Loading order tracking…',
    'checkout.closeConfirmed': 'Close — order will remain confirmed',
    'checkout.amountDue': 'Amount Due',
    'checkout.supportedWallets': 'Supported Wallets',
    'checkout.completePayment': 'Complete Payment on Deliverect Pay',
    'checkout.cancelReturn': 'Cancel & Return to Basket',

    'order.statusAccepted': 'Order Accepted by Store',
    'order.statusPicking': 'Quest Picking in Progress',
    'order.statusPickingWithChanges': 'Picking Updated with Substitutions',
    'order.statusPaymentFinalising': 'Re-Authorization Required',
    'order.statusReadyCourier': 'Packed & Awaiting Courier',
    'order.statusCourierAssigned': 'Courier Assigned & En Route',
    'order.statusCourierAtStore': 'Courier Collected Package',
    'order.statusOutForDelivery': 'Out for Delivery to Your Door',
    'order.statusDelivered': 'Delivered • Enjoy your groceries',
    'order.statusCancelled': 'Order Cancelled',
    'order.itemPicked': 'Picked',
    'order.itemSubstituted': 'Substituted',
    'order.itemQuantityAmended': 'Quantity Adjusted',
    'order.itemRemoved': 'Item Out of Stock',
    'order.reauthorizeRequired': 'Picked basket exceeded initial authorization ceiling.',
    'order.approveReauth': 'Approve Updated Total',

    'product.closeDetails': 'Close product details',
    'product.noImage': 'No image available',
    'product.includesDeposit': 'Includes {amount} DRS returnable deposit',
    'product.caloriesEnergy': 'Calories / Energy',
    'product.fat': 'Fat',
    'product.carbs': 'Carbs',
    'product.protein': 'Protein',
    'product.sugars': 'Sugars',
    'product.salt': 'Salt',
    'product.netQuantity': 'Net Quantity',
    'product.storageInstructions': 'Storage Instructions',
    'product.manufacturerOrigin': 'Manufacturer & Origin Information',
    'product.manufacturer': 'FBO / Manufacturer',
    'product.countryOrigin': 'Country of Origin',
    'product.alcoholDetails': 'Alcohol & Licensing Details',
    'product.legalNotice': 'Legal Notice',
    'product.age18Notice': 'Age 18+ only. Courier ID verification may be required.',
    'product.depositScheme': 'Deposit Return Scheme (DRS)',
    'product.depositNotice': 'Price includes a refundable container deposit.',
    'product.total': 'Total',
    'product.chooseStore': 'Choose Store to Order',
    'product.addToBasket': 'Add to Basket',
    'product.specialOffer': 'Special Offer',
    'product.priceUnavailable': 'Price unavailable',
    'product.outOfStockNearby': 'Currently out of stock nearby. View store availability.',
    'product.availableAllStores': 'Available at all {count} shops. View prices per store.',
    'product.availableSomeStores': 'Available in {available} of {total} shops. View prices per store.',
    'product.compareStores': 'Compare Stores',
    'product.description': 'Description',
    'product.allergenInformation': 'Allergen Information',
    'product.ingredients': 'Ingredients',
    'product.nutritionalValues': 'Nutritional Values',
    'product.dietaryLifestyle': 'Dietary & Lifestyle',
    'product.outOfStock': 'Out of Stock',
    'orders.title': 'Your Orders & Deliveries',
    'orders.refresh': 'Refresh',
    'orders.recentActivity': 'Recent Activity',
    'orders.noActive': 'No active orders yet',
    'orders.emptyLive': 'Your current and previous orders will appear here.',
    'orders.actionRequired': 'Action Required',
    'orders.item': 'item',
    'orders.items': 'items',
    'orders.withSubstitutions': 'with substitutions',
    'orders.payment': 'Payment',
    'orders.pending': 'Pending',
    'orders.trackOrder': 'Track Order',
    'orders.paymentAuthorized': 'Authorised',
    'orders.paymentCaptured': 'Captured',
    'orders.paymentActionRequired': 'Action required',
    'orders.paymentTokenized': 'Card saved securely',
    'order.statusSubmitted': 'Order Submitted',
    'order.statusPickedPacked': 'Items Picked & Packed',
    'order.statusReadyCollection': 'Ready for Collection',

    'tracking.allOrders': 'All Orders',
    'tracking.courierDelivery': 'Courier Delivery',
    'tracking.storeCollection': 'Store Collection',
    'tracking.scheduled': 'Scheduled',
    'tracking.asapDelivery': 'ASAP Delivery',
    'tracking.finalChargedTotal': 'Final Charged / Total',
    'tracking.orderCancelled': 'Order Cancelled',
    'tracking.cancelledFallback': 'This order was cancelled because a required item was unavailable, per your substitution preferences.',
    'tracking.paymentHoldReleased': 'Your payment pre-authorisation hold has been released in full. No charges were made.',
    'tracking.reauthRequired': 'Payment Reauthorisation Required',
    'tracking.reauthPrefix': 'During picking in store, substitutions or weight adjustments raised your final order total to',
    'tracking.reauthExceeds': 'which exceeds your original approved limit of',
    'tracking.reauthSuffix': 'Please review and approve the updated total to release for courier dispatch.',
    'tracking.authorizing': 'Authorising...',
    'tracking.approvePay': 'Approve & Pay',
    'tracking.lifecycleTitle': 'Retail & Grocery Lifecycle',
    'tracking.lifecycleNotice': 'You are never charged immediately at checkout. Funds are only captured when store picking completes with our Best-Match Price Guarantee.',
    'tracking.pickingItems': 'Picking Items',
    'tracking.timeline': 'Timeline',
    'tracking.paymentAuthorization': 'Payment & Authorisation',
    'tracking.storePickingState': 'Store Picking State',
    'tracking.status': 'Status',
    'tracking.substituted': 'Substituted',
    'tracking.quantityAdjusted': 'Quantity Adjusted',
    'tracking.outOfStockRefunded': 'Out of stock • Refunded',
    'tracking.picked': 'Picked',
    'tracking.awaitingPicker': 'Awaiting Picker',
    'tracking.requested': 'Requested',
    'tracking.supplied': 'Supplied',
    'tracking.substitute': 'Substitute',
    'tracking.shelf': 'Shelf',
    'tracking.youPay': 'You pay',
    'tracking.note': 'Note',
    'tracking.was': 'was',
    'tracking.paymentBreakdown': 'Payment Breakdown',
    'tracking.originalEstimate': 'Original Basket Estimate',
    'tracking.approvedCeiling': 'Customer Approved Ceiling (Auth Max)',
    'tracking.deliveryCharge': 'Delivery Charge',
    'tracking.bagServiceFees': 'Bag & Service Fees',
    'tracking.finalCaptured': 'Final Captured Amount',
    'tracking.auditHistory': 'Audit & State History',
    'tracking.cardTokenized': 'Card Tokenized',
    'tracking.preAuthorizedEstimated': 'Pre-Authorised (Estimated)',
    'tracking.actionReauthorize': 'Action Required: Reauthorise',
    'tracking.finalTotalCaptured': 'Final Total Captured',
    'tracking.pending': 'Pending',
    'tracking.by': 'by',
    'tracking.eta': 'ETA',

    'error.general': 'An unexpected error occurred. Please try again.',
    'error.stockDepleted': 'Selected product is out of stock in this store.',
    'error.noServiceableStore': 'No serviceable stores found for your current delivery address.',
    'error.paymentDeclined': 'Payment authorization was declined by your financial provider.',
    'error.mediaFailed': 'Media asset could not be loaded.',

    'fav.emptyTitle': 'No favourites yet',
    'fav.emptySubtitle': 'Tap the heart on any product to save it for quick reordering.',
    'fav.reorderAll': 'Reorder All Available',
    'fav.revalidating': 'Revalidating store stock & prices...',
    'fav.addedToBasket': 'Added to basket',
    'search.placeholder': 'Search groceries, brands, barcode or tags…',
    'search.trending': 'Trending Searches',
    'search.searching': 'Searching catalogue…',
    'search.foundItem': 'item',
    'search.foundItems': 'items',
    'search.forQuery': 'for',
    'search.multiStore': 'Showing multi-store availability',
    'search.noResults': 'No matching products found',
    'search.noResultsHint': 'Try searching for another product, brand or category.',
    'aisles.all': 'All Aisles',
    'aisles.allCategoryPrefix': 'All',
    'aisles.browsingStore': 'Browsing',
    'aisles.selectShelf': 'Select an aisle or product shelf',
    'aisles.searchPlaceholder': 'Search aisles, dairy, bakery, produce…',
    'aisles.back': 'Back',
    'aisles.viewAllIn': 'View all in',
    'aisles.browseEntire': 'Browse the entire catalogue without category filters',
    'aisles.selected': 'Selected',
    'aisles.noMatching': 'No aisles matching',
    'aisles.trySearchHint': 'Try another category or product type.',
    'aisles.clearSearch': 'Clear Search',
    'aisles.item': 'item',
    'aisles.items': 'items',
    'aisles.searchAisles': 'Search Aisles',
    'aisles.parentAisle': 'Parent Aisle',
    'aisles.more': 'More',
    'aisles.category': 'Category',
    'aisles.productsSearchPlaceholder': 'Search products & aisles…',
  },

  'es-ES': {
    'nav.home': 'Inicio',
    'nav.search': 'Buscar',
    'nav.orders': 'Pedidos',
    'nav.account': 'Cuenta',
    'nav.aisles': 'Pasillos',
    'nav.favourites': 'Favoritos',
    'nav.buyAgain': 'Comprar de nuevo',
    'nav.admin': 'Panel de Control',

    'header.deliveringTo': 'Entregando en',
    'header.collectFrom': 'Recoger en',
    'header.changeLocation': 'Cambiar',
    'header.selectStore': 'Seleccionar Tienda',
    'header.openStores': 'Tiendas abiertas cercanas',
    'header.closedStoreNotice': 'Actualmente cerrada',
    'header.acceptsPreOrders': 'Reserva abierta para entrega programada',
    'header.setLocation': 'Establecer ubicación',
    'header.allStores': 'Todas las tiendas',
    'header.delivery': 'Entrega',
    'header.collect': 'Recogida',
    'header.deliveryOnly': 'Solo entrega',
    'header.profilePreferences': 'Perfil y preferencias',
    'header.ordersTracking': 'Pedidos y seguimiento',
    'header.basket': 'Cesta',
    'fulfilment.title': '¿Cómo quieres recibir tu pedido?',
    'fulfilment.subtitle': 'Elige entrega a domicilio o recogida en tienda',
    'fulfilment.deliverTo': 'Entregar en',
    'fulfilment.delivery': 'Entrega a domicilio',
    'fulfilment.collection': 'Recoger en tienda',
    'location.deliveryAddress': 'Dirección de entrega',
    'location.liveRouting': 'Distancia y ruta en tiempo real',
    'location.map': 'Mapa',
    'location.list': 'Lista',
    'fulfilment.comingSoon': 'Próximamente',
    'fulfilment.available': 'Disponible',
    'fulfilment.limitedZone': 'Zona limitada',
    'fulfilment.notAvailableYet': 'Todavía no disponible — elige recogida en tienda',
    'fulfilment.storeDelivers': 'tienda cercana entrega en tu dirección',
    'fulfilment.storesDeliver': 'tiendas cercanas entregan en tu dirección',
    'fulfilment.collectionAvailable': 'Recogida disponible en tiendas cercanas',
    'fulfilment.free': 'Gratis',
    'fulfilment.localBranch': 'tienda local',
    'fulfilment.localBranches': 'tiendas locales',
    'location.selectedLocation': 'Ubicación seleccionada',
    'location.hideMap': 'Ocultar mapa',
    'location.showMap': 'Mostrar mapa',
    'location.locating': 'Localizando…',
    'location.useCurrentLocation': 'Usar ubicación actual',
    'location.savedAddresses': 'Direcciones guardadas',
    'location.confirmContinue': 'Confirmar y continuar',

    'account.languageRegion': 'Idioma y región',
    'account.savedAddresses': 'Direcciones de entrega guardadas',
    'account.paymentMethods': 'Métodos de pago',
    'account.notifications': 'Notificaciones de pedidos y entrega',
    'account.brandInfoPolicies': 'Información y políticas de la marca',
    'account.signIn': 'Iniciar sesión',
    'account.signOut': 'Cerrar sesión',
    'account.notSignedIn': 'Sesión no iniciada',
    'account.verifiedAccount': 'Cuenta verificada',
    'account.guestSession': 'Sesión de invitado',
    'account.customerSupport': 'atención al cliente',
    'account.supportEmailMissing': 'Correo de soporte no configurado',
    'account.supportPhoneMissing': 'Teléfono de soporte no configurado',
    'account.supportHours': 'Horario',
    'account.supportHoursFallback': 'Consulta la información de la tienda para ver el horario',
    'account.operationsPortal': 'Portal de operaciones de la marca',
    'account.operationsPortalDescription': 'Gestiona tarifas, reglas, historias, marca y análisis',
    'account.launchAdmin': 'Abrir Admin',
    'account.signInToManage': 'Inicia sesión para gestionar la configuración de tu cuenta.',
    'account.noSavedAddresses': 'Todavía no hay direcciones de entrega guardadas en esta cuenta.',
    'account.paymentProviderNote': 'Los métodos de pago se recopilan de forma segura durante el pago y solo se muestran aquí si el proveedor de pagos permite métodos guardados.',
    'account.notificationNote': 'Las actualizaciones del pedido usan los datos de contacto y canales disponibles para cada pedido.',
    'account.noPolicies': 'Todavía no hay páginas de información o políticas publicadas en este idioma.',

    'basket.title': 'Tu Cesta',
    'basket.emptyTitle': 'Tu cesta está vacía',
    'basket.emptySubtitle': 'Añade productos frescos para comenzar.',
    'basket.startShopping': 'Empezar a comprar',
    'basket.subtotal': 'Subtotal',
    'basket.deliveryFee': 'Gastos de envío',
    'basket.serviceFee': 'Servicio y embalaje',
    'basket.bagFee': 'Bolsas',
    'basket.deposit': 'Depósito retornable (DRS)',
    'basket.discount': 'Descuento',
    'basket.tip': 'Propina repartidor',
    'basket.total': 'Total estimado',
    'basket.checkoutBtn': 'Revisar y Pagar',
    'basket.clearBasket': 'Vaciar cesta',
    'basket.youMayHaveForgotten': '¿Has olvidado algo?',
    'basket.saving': 'Ahorras',
    'basket.selectedStore': 'Tienda seleccionada',
    'basket.unavailableAtStore': 'artículo(s) no disponible(s) en esta tienda',
    'basket.swapAllInStock': 'Cambiar todos los disponibles',
    'basket.stockCheckNotice': 'La comprobación de stock en tiempo real encontró artículos pausados o agotados. Puedes cambiarlos por alternativas disponibles o eliminarlos.',
    'basket.comboDeal': 'Oferta combinada',
    'basket.quantityUnavailable': 'Cantidad no disponible',
    'basket.snoozedByStore': 'Pausado por la tienda',
    'basket.unavailableHere': 'No disponible en esta tienda',
    'basket.each': 'cada uno',
    'basket.drsDeposit': 'Depósito DRS',
    'basket.inStockSubstitute': 'Sustituto disponible',
    'basket.swap': 'Cambiar',
    'basket.ifUnavailable': 'Si no está disponible',
    'basket.preChosenSubstitute': 'Sustituto elegido',
    'basket.removeItem': 'Eliminar artículo',
    'basket.cancelEntireOrder': 'Cancelar todo el pedido',
    'basket.bestMatch': 'Mejor opción',
    'basket.alternativeSelected': 'alternativa seleccionada',
    'basket.buffer': 'margen',
    'basket.cancel': 'Cancelar',
    'basket.refund': 'Reembolso',
    'basket.cheapest': 'Más barato',
    'basket.chooseOne': 'Elige 1',
    'basket.addToCompleteDeal': 'para completar esta oferta',
    'basket.chooseItem': 'Elegir artículo',
    'basket.addSave': 'Añadir y ahorrar',
    'basket.completeDeal': 'Completar',
    'basket.chooseInStock': 'Elige un artículo disponible de',
    'basket.dealDiscount': 'Descuento de oferta',
    'basket.totalDealSavings': 'Ahorro total aplicado',
    'basket.totalToPay': 'Total a pagar',
    'basket.cardPreAuth': 'Preautorización de tarjeta',
    'basket.estimated': 'estim.',
    'basket.preAuthNotice': 'Tu método de pago se autoriza por el total estimado. Solo se cobra lo confirmado y preparado en tienda; cualquier diferencia se libera inmediatamente.',
    'basket.reviewResolve': 'Revisar y resolver artículos en el pago',
    'basket.goCheckout': 'Ir al pago',
    'basket.hfssTitle': 'Cumplimiento de promociones alimentarias del Reino Unido (HFSS)',
    'basket.hfssNotice': 'oportunidad de oferta suprimida de las recomendaciones por las normas británicas de promoción y colocación de alimentos al contener un artículo alto en grasa, azúcar o sal.',
    'basket.item': 'Artículo de la cesta',
    'basket.ifItemUnavailable': 'Si este artículo no está disponible',
    'basket.unavailablePreferenceHelp': 'Elige qué debe hacer la tienda con este artículo durante la preparación.',
    'basket.substituteBestMatch': 'Sustituir si no está disponible (mejor opción)',
    'basket.cheapestOption': 'Opción más barata',
    'basket.bestMatchHelp': 'La tienda solo podrá cambiarlo por un producto del mismo precio o más barato. Siempre pagarás el precio más bajo.',
    'basket.preChooseSubstitute': 'Elegir sustituto previamente',
    'basket.bufferAdjusted': 'Margen ajustado',
    'basket.preChooseHelp': 'Elige 1 alternativa. Si cuesta más, ese valor se incluye en el margen de preautorización de tu tarjeta.',
    'basket.sameOrCheaper': 'Igual o más barato',
    'basket.change': 'Cambiar',
    'basket.selectAlternative': 'Seleccionar 1 alternativa',
    'basket.preAuthBufferUpdate': 'Actualización del margen de preautorización',
    'basket.extra': 'Extra',
    'basket.bufferNoticeSuffix': 'se reservará en tu tarjeta. Si se prepara, pagarás ese precio; si el artículo original está disponible, pagarás el precio original.',
    'basket.chooseAlternativeProduct': 'Elegir producto alternativo',
    'basket.searchAlternatives': 'Buscar alternativas...',
    'basket.noPriceDifference': 'sin diferencia de precio',
    'basket.removeIfUnavailable': 'Eliminar si no está disponible',
    'basket.autoRefund': 'Reembolso automático',
    'basket.removeUnavailableHelp': 'La tienda solo eliminará este artículo si no está disponible. Se reembolsará el importe completo.',
    'basket.cancelIfUnavailable': 'Cancelar todo el pedido si no está disponible',
    'basket.essentialItem': 'Artículo esencial',
    'basket.cancelUnavailableHelp': 'Si este artículo no está disponible, no se entregará el pedido. Se cancelará sin ningún cargo.',
    'basket.update': 'Actualizar',

    'checkout.title': 'Pago y Preautorización',
    'checkout.scheduling': 'Horario de entrega',
    'checkout.asap': 'Lo antes posible',
    'checkout.scheduled': 'Franja programada',
    'checkout.selectSlot': 'Selecciona franja de entrega',
    'checkout.substitutionPreferences': 'Preferencia de sustitución',
    'checkout.subBestMatch': 'Mejor coincidencia',
    'checkout.subCustomerSelected': 'Sustituto elegido por ti',
    'checkout.subDoNotSubstitute': 'No sustituir',
    'checkout.subRemoveUnavailable': 'Eliminar si no está disponible',
    'checkout.subCancelOrder': 'Cancelar pedido si no está',
    'checkout.lowerPriceGuarantee': 'Garantía de precio menor: si el sustituto es más caro, pagas el precio original.',
    'checkout.authNoticeTitle': 'Modelo de Preautorización',
    'checkout.authNoticeDesc': 'No se te cobra inmediatamente. Preautorizamos el importe estimado y solo cobramos al finalizar la preparación en tienda.',
    'checkout.authorizeAndSubmit': 'Autorizar y Realizar Pedido',
    'checkout.authorizing': 'Autorizando y asegurando envío...',
    'checkout.noRawCardExposure': 'Tokenizado PCI • Sin datos sensibles en cliente',
    'checkout.orderTracking': 'Seguimiento del pedido',
    'checkout.hostedCheckout': 'Pago alojado de Deliverect Pay',
    'checkout.confirmingOrder': 'Confirmando pedido',
    'checkout.secureCheckout': 'Pago seguro',
    'checkout.deliveryAddress': 'Dirección de entrega',
    'checkout.noDeliveryAddress': 'No se ha indicado dirección de entrega',
    'checkout.fulfillmentMethod': 'Método de entrega',
    'checkout.inStoreCollection': 'Recogida en tienda',
    'checkout.selectedStore': 'Tienda seleccionada',
    'checkout.fulfillingStore': 'Tienda que prepara el pedido',
    'checkout.immediatePriority': 'Prioridad inmediata',
    'checkout.preOrderSlot': 'Franja de reserva',
    'checkout.asapCollection': 'Recogida lo antes posible',
    'checkout.asapDelivery': 'Entrega lo antes posible',
    'checkout.scheduledSlot': 'Franja programada',
    'checkout.selectDateTime': 'Selecciona fecha/hora',
    'checkout.selectReservationWindow': 'Selecciona una franja',
    'checkout.bestMatchGuarantee': 'Garantía de mejor coincidencia: siempre pagas el precio más bajo.',
    'checkout.chooseOutOfStock': 'Elige qué debe hacer la tienda si un artículo no está disponible.',
    'checkout.contactDetails': 'Datos de contacto',
    'checkout.contactDetailsHelp': 'La tienda los usará para este pedido. Indica un nombre y un correo electrónico o teléfono.',
    'checkout.name': 'Nombre',
    'checkout.email': 'Correo electrónico',
    'checkout.phone': 'Teléfono',
    'checkout.namePlaceholder': 'Nombre para la recogida',
    'checkout.tipCourier': 'Propina para el repartidor (100% para el conductor)',
    'checkout.none': 'Ninguna',
    'checkout.promoCode': 'Código promocional o regalo',
    'checkout.promoPlaceholder': 'p. ej. SAVE5 o FREEDELIV',
    'checkout.apply': 'Aplicar',
    'checkout.applying': 'Aplicando…',
    'checkout.payableTotal': 'Total a pagar',
    'checkout.collectionOrder': 'Pedido para recoger',
    'checkout.collectionNotice': 'Este pedido de recogida se envía directamente a la tienda. No se crea preautorización, cobro ni envío por mensajero.',
    'checkout.paymentModel': 'Modelo de pago para alimentación',
    'checkout.placingCollection': 'Enviando pedido de recogida…',
    'checkout.resolveStock': 'Resuelve los artículos sin stock de arriba',
    'checkout.collectionIssue': 'Problema con la recogida — reintenta arriba',
    'checkout.dispatchUnavailable': 'Reparto no disponible — reintenta arriba',
    'checkout.placeCollection': 'Realizar pedido para recoger',
    'checkout.hostedPayAlternative': 'O usa la sesión alojada de Deliverect Pay',
    'checkout.collectionNoPayment': 'Sin autorización de pago ni reparto para recogida',
    'checkout.secureCardNotice': 'Sin exposición de tarjeta • Preautorización tokenizada PCI',
    'checkout.hostedSession': 'Sesión alojada de Deliverect Pay',
    'checkout.processingOrder': 'Procesando pedido',
    'checkout.orderConfirmed': 'Pedido confirmado',
    'checkout.loadingTracking': 'Cargando seguimiento…',
    'checkout.closeConfirmed': 'Cerrar — el pedido seguirá confirmado',
    'checkout.amountDue': 'Importe a pagar',
    'checkout.supportedWallets': 'Carteras compatibles',
    'checkout.completePayment': 'Completar pago en Deliverect Pay',
    'checkout.cancelReturn': 'Cancelar y volver a la cesta',

    'order.statusAccepted': 'Pedido Aceptado por la tienda',
    'order.statusPicking': 'Preparación en curso',
    'order.statusPickingWithChanges': 'Preparado con sustituciones',
    'order.statusPaymentFinalising': 'Reautorización Requerida',
    'order.statusReadyCourier': 'Empaquetado y esperando repartidor',
    'order.statusCourierAssigned': 'Repartidor asignado',
    'order.statusCourierAtStore': 'Repartidor recogió el paquete',
    'order.statusOutForDelivery': 'En camino hacia tu puerta',
    'order.statusDelivered': 'Entregado • Buen provecho',
    'order.statusCancelled': 'Pedido Cancelado',
    'order.itemPicked': 'Recogido',
    'order.itemSubstituted': 'Sustituido',
    'order.itemQuantityAmended': 'Cantidad Ajustada',
    'order.itemRemoved': 'Agotado',
    'order.reauthorizeRequired': 'El total preparado superó el límite inicial autorizado.',
    'order.approveReauth': 'Aprobar Total Actualizado',

    'product.closeDetails': 'Cerrar detalles del producto',
    'product.noImage': 'Imagen no disponible',
    'product.includesDeposit': 'Incluye un depósito DRS reembolsable de {amount}',
    'product.caloriesEnergy': 'Calorías / Energía',
    'product.fat': 'Grasas',
    'product.carbs': 'Carbohidratos',
    'product.protein': 'Proteínas',
    'product.sugars': 'Azúcares',
    'product.salt': 'Sal',
    'product.netQuantity': 'Cantidad neta',
    'product.storageInstructions': 'Conservación',
    'product.manufacturerOrigin': 'Fabricante y origen',
    'product.manufacturer': 'Operador / Fabricante',
    'product.countryOrigin': 'País de origen',
    'product.alcoholDetails': 'Alcohol y licencia',
    'product.legalNotice': 'Aviso legal',
    'product.age18Notice': 'Solo para mayores de 18 años. Puede requerirse verificación de identidad.',
    'product.depositScheme': 'Sistema de depósito y devolución (DRS)',
    'product.depositNotice': 'El precio incluye un depósito reembolsable por el envase.',
    'product.total': 'Total',
    'product.chooseStore': 'Elegir tienda para pedir',
    'product.addToBasket': 'Añadir a la cesta',
    'product.specialOffer': 'Oferta especial',
    'product.priceUnavailable': 'Precio no disponible',
    'product.outOfStockNearby': 'Actualmente agotado cerca. Consulta la disponibilidad por tienda.',
    'product.availableAllStores': 'Disponible en las {count} tiendas. Consulta los precios por tienda.',
    'product.availableSomeStores': 'Disponible en {available} de {total} tiendas. Consulta los precios por tienda.',
    'product.compareStores': 'Comparar tiendas',
    'product.description': 'Descripción',
    'product.allergenInformation': 'Información sobre alérgenos',
    'product.ingredients': 'Ingredientes',
    'product.nutritionalValues': 'Valores nutricionales',
    'product.dietaryLifestyle': 'Dieta y estilo de vida',
    'product.outOfStock': 'Agotado',
    'orders.title': 'Tus pedidos y entregas',
    'orders.refresh': 'Actualizar',
    'orders.recentActivity': 'Actividad reciente',
    'orders.noActive': 'Todavía no hay pedidos activos',
    'orders.emptyLive': 'Tus pedidos actuales y anteriores aparecerán aquí.',
    'orders.actionRequired': 'Acción necesaria',
    'orders.item': 'artículo',
    'orders.items': 'artículos',
    'orders.withSubstitutions': 'con sustituciones',
    'orders.payment': 'Pago',
    'orders.pending': 'Pendiente',
    'orders.trackOrder': 'Seguir pedido',
    'orders.paymentAuthorized': 'Autorizado',
    'orders.paymentCaptured': 'Cobrado',
    'orders.paymentActionRequired': 'Acción necesaria',
    'orders.paymentTokenized': 'Tarjeta guardada de forma segura',
    'order.statusSubmitted': 'Pedido enviado',
    'order.statusPickedPacked': 'Artículos preparados',
    'order.statusReadyCollection': 'Listo para recoger',

    'tracking.allOrders': 'Todos los pedidos',
    'tracking.courierDelivery': 'Entrega con repartidor',
    'tracking.storeCollection': 'Recogida en tienda',
    'tracking.scheduled': 'Programado',
    'tracking.asapDelivery': 'Entrega lo antes posible',
    'tracking.finalChargedTotal': 'Total final / cobrado',
    'tracking.orderCancelled': 'Pedido cancelado',
    'tracking.cancelledFallback': 'Este pedido se canceló porque un artículo obligatorio no estaba disponible, según tus preferencias de sustitución.',
    'tracking.paymentHoldReleased': 'La retención de preautorización se ha liberado por completo. No se realizó ningún cargo.',
    'tracking.reauthRequired': 'Se necesita una nueva autorización de pago',
    'tracking.reauthPrefix': 'Durante la preparación, las sustituciones o ajustes de peso elevaron el total final a',
    'tracking.reauthExceeds': 'que supera tu límite aprobado de',
    'tracking.reauthSuffix': 'Revisa y aprueba el total actualizado para continuar con el reparto.',
    'tracking.authorizing': 'Autorizando...',
    'tracking.approvePay': 'Aprobar y pagar',
    'tracking.lifecycleTitle': 'Ciclo del pedido',
    'tracking.lifecycleNotice': 'No se te cobra inmediatamente. El pago solo se captura cuando termina la preparación en tienda, con nuestra garantía de mejor precio.',
    'tracking.pickingItems': 'Artículos en preparación',
    'tracking.timeline': 'Cronología',
    'tracking.paymentAuthorization': 'Pago y autorización',
    'tracking.storePickingState': 'Estado de preparación',
    'tracking.status': 'Estado',
    'tracking.substituted': 'Sustituido',
    'tracking.quantityAdjusted': 'Cantidad ajustada',
    'tracking.outOfStockRefunded': 'Agotado • Reembolsado',
    'tracking.picked': 'Preparado',
    'tracking.awaitingPicker': 'Pendiente de preparación',
    'tracking.requested': 'Solicitado',
    'tracking.supplied': 'Entregado',
    'tracking.substitute': 'Sustituto',
    'tracking.shelf': 'Precio en tienda',
    'tracking.youPay': 'Pagas',
    'tracking.note': 'Nota',
    'tracking.was': 'antes',
    'tracking.paymentBreakdown': 'Desglose del pago',
    'tracking.originalEstimate': 'Estimación original de la cesta',
    'tracking.approvedCeiling': 'Límite aprobado por el cliente',
    'tracking.deliveryCharge': 'Gastos de entrega',
    'tracking.bagServiceFees': 'Bolsas y servicio',
    'tracking.finalCaptured': 'Importe final cobrado',
    'tracking.auditHistory': 'Historial de estados',
    'tracking.cardTokenized': 'Tarjeta tokenizada',
    'tracking.preAuthorizedEstimated': 'Preautorizado (estimado)',
    'tracking.actionReauthorize': 'Acción necesaria: volver a autorizar',
    'tracking.finalTotalCaptured': 'Total final cobrado',
    'tracking.pending': 'Pendiente',
    'tracking.by': 'por',
    'tracking.eta': 'Hora estimada',

    'error.general': 'Ocurrió un error inesperado. Inténtalo de nuevo.',
    'error.stockDepleted': 'El producto seleccionado está agotado en esta tienda.',
    'error.noServiceableStore': 'No hay tiendas disponibles para esta dirección.',
    'error.paymentDeclined': 'La autorización de pago fue rechazada.',
    'error.mediaFailed': 'No se pudo cargar el archivo multimedia.',

    'fav.emptyTitle': 'Sin favoritos aún',
    'fav.emptySubtitle': 'Pulsa el corazón en cualquier producto para guardarlo.',
    'fav.reorderAll': 'Pedir todos los disponibles',
    'fav.revalidating': 'Revalidando disponibilidad...',
    'fav.addedToBasket': 'Añadido a la cesta',
    'search.placeholder': 'Buscar productos, marcas, códigos de barras o etiquetas…',
    'search.trending': 'Búsquedas populares',
    'search.searching': 'Buscando en el catálogo…',
    'search.foundItem': 'artículo',
    'search.foundItems': 'artículos',
    'search.forQuery': 'para',
    'search.multiStore': 'Mostrando disponibilidad en varias tiendas',
    'search.noResults': 'No se encontraron productos',
    'search.noResultsHint': 'Prueba con otro producto, marca o categoría.',
    'aisles.all': 'Todos los pasillos',
    'aisles.allCategoryPrefix': 'Todo',
    'aisles.browsingStore': 'Explorando',
    'aisles.selectShelf': 'Selecciona un pasillo o sección',
    'aisles.searchPlaceholder': 'Buscar pasillos, lácteos, panadería, fruta…',
    'aisles.back': 'Atrás',
    'aisles.viewAllIn': 'Ver todo en',
    'aisles.browseEntire': 'Explora todo el catálogo sin filtros de categoría',
    'aisles.selected': 'Seleccionado',
    'aisles.noMatching': 'No hay pasillos que coincidan con',
    'aisles.trySearchHint': 'Prueba otra categoría o tipo de producto.',
    'aisles.clearSearch': 'Borrar búsqueda',
    'aisles.item': 'artículo',
    'aisles.items': 'artículos',
    'aisles.searchAisles': 'Buscar pasillos',
    'aisles.parentAisle': 'Pasillo superior',
    'aisles.more': 'Más',
    'aisles.category': 'Categoría',
    'aisles.productsSearchPlaceholder': 'Buscar productos y pasillos…',
  },

  'fr-FR': {
    'nav.home': 'Accueil',
    'nav.search': 'Recherche',
    'nav.orders': 'Commandes',
    'nav.account': 'Compte',
    'nav.aisles': 'Rayons',
    'nav.favourites': 'Favoris',
    'nav.buyAgain': 'Commander à nouveau',
    'nav.admin': 'Console Admin',

    'header.deliveringTo': 'Livraison à',
    'header.collectFrom': 'Retrait à',
    'header.changeLocation': 'Modifier',
    'header.selectStore': 'Choisir le magasin',
    'header.openStores': 'Magasins ouverts à proximité',
    'header.closedStoreNotice': 'Actuellement fermé',
    'header.acceptsPreOrders': 'Précommande ouverte pour livraison programmée',
    'header.setLocation': 'Définir le lieu',
    'header.allStores': 'Tous les magasins',
    'header.delivery': 'Livraison',
    'header.collect': 'Retrait',
    'header.deliveryOnly': 'Livraison uniquement',
    'header.profilePreferences': 'Profil et préférences',
    'header.ordersTracking': 'Commandes et suivi',
    'header.basket': 'Panier',
    'fulfilment.title': 'Comment souhaitez-vous recevoir votre commande ?',
    'fulfilment.subtitle': 'Choisissez la livraison à domicile ou le retrait en magasin',
    'fulfilment.deliverTo': 'Livrer à',
    'fulfilment.delivery': 'Livraison à domicile',
    'fulfilment.collection': 'Retrait en magasin',
    'location.deliveryAddress': 'Adresse de livraison',
    'location.liveRouting': 'Distance et itinéraire en direct',
    'location.map': 'Carte',
    'location.list': 'Liste',
    'fulfilment.comingSoon': 'Bientôt disponible',
    'fulfilment.available': 'Disponible',
    'fulfilment.limitedZone': 'Zone limitée',
    'fulfilment.notAvailableYet': 'Pas encore disponible — choisissez le retrait en magasin',
    'fulfilment.storeDelivers': 'magasin à proximité livre à votre adresse',
    'fulfilment.storesDeliver': 'magasins à proximité livrent à votre adresse',
    'fulfilment.collectionAvailable': 'Retrait disponible dans les magasins à proximité',
    'fulfilment.free': 'Gratuit',
    'fulfilment.localBranch': 'magasin local',
    'fulfilment.localBranches': 'magasins locaux',
    'location.selectedLocation': 'Lieu sélectionné',
    'location.hideMap': 'Masquer la carte',
    'location.showMap': 'Afficher la carte',
    'location.locating': 'Localisation…',
    'location.useCurrentLocation': 'Utiliser ma position',
    'location.savedAddresses': 'Adresses enregistrées',
    'location.confirmContinue': 'Confirmer et continuer',

    'account.languageRegion': 'Langue et région',
    'account.savedAddresses': 'Adresses de livraison enregistrées',
    'account.paymentMethods': 'Moyens de paiement',
    'account.notifications': 'Notifications de commande et de livraison',
    'account.brandInfoPolicies': 'Informations et politiques de la marque',
    'account.signIn': 'Se connecter',
    'account.signOut': 'Se déconnecter',
    'account.notSignedIn': 'Non connecté',
    'account.verifiedAccount': 'Compte vérifié',
    'account.guestSession': 'Session invité',
    'account.customerSupport': 'service client',
    'account.supportEmailMissing': 'E-mail du support non configuré',
    'account.supportPhoneMissing': 'Téléphone du support non configuré',
    'account.supportHours': 'Horaires',
    'account.supportHoursFallback': 'Consultez les informations du magasin pour les horaires',
    'account.operationsPortal': 'Portail des opérations de la marque',
    'account.operationsPortalDescription': 'Gérer les frais, règles, stories, marque et analyses',
    'account.launchAdmin': 'Ouvrir Admin',
    'account.signInToManage': 'Connectez-vous pour gérer les paramètres liés à votre compte.',
    'account.noSavedAddresses': 'Aucune adresse de livraison enregistrée pour ce compte.',
    'account.paymentProviderNote': 'Les moyens de paiement sont collectés de manière sécurisée lors du paiement et ne sont affichés ici que si le prestataire prend en charge les moyens enregistrés.',
    'account.notificationNote': 'Les mises à jour de commande utilisent les coordonnées et canaux disponibles pour chaque commande.',
    'account.noPolicies': 'Aucune page d’information ou de politique n’est encore publiée dans cette langue.',

    'basket.title': 'Votre Panier',
    'basket.emptyTitle': 'Votre panier est vide',
    'basket.emptySubtitle': 'Ajoutez des produits frais pour commencer.',
    'basket.startShopping': 'Commencer mes achats',
    'basket.subtotal': 'Sous-total',
    'basket.deliveryFee': 'Frais de livraison',
    'basket.serviceFee': 'Service et emballage',
    'basket.bagFee': 'Sacs',
    'basket.deposit': 'Consigne bouteille (DRS)',
    'basket.discount': 'Réduction',
    'basket.tip': 'Pourboire livreur',
    'basket.total': 'Total estimé',
    'basket.checkoutBtn': 'Vérifier et Payer',
    'basket.clearBasket': 'Vider le panier',
    'basket.youMayHaveForgotten': 'Avez-vous oublié quelque chose ?',
    'basket.saving': 'Économie',
    'basket.selectedStore': 'Magasin sélectionné',
    'basket.unavailableAtStore': 'article(s) indisponible(s) dans ce magasin',
    'basket.swapAllInStock': 'Tout remplacer par des articles disponibles',
    'basket.stockCheckNotice': 'La vérification du stock en temps réel a trouvé des articles suspendus ou en rupture. Vous pouvez les remplacer par des alternatives disponibles ou les supprimer.',
    'basket.comboDeal': 'Offre combinée',
    'basket.quantityUnavailable': 'Quantité indisponible',
    'basket.snoozedByStore': 'Suspendu par le magasin',
    'basket.unavailableHere': 'Indisponible dans ce magasin',
    'basket.each': 'l’unité',
    'basket.drsDeposit': 'Consigne DRS',
    'basket.inStockSubstitute': 'Substitut disponible',
    'basket.swap': 'Remplacer',
    'basket.ifUnavailable': 'Si indisponible',
    'basket.preChosenSubstitute': 'Substitut choisi',
    'basket.removeItem': 'Supprimer l’article',
    'basket.cancelEntireOrder': 'Annuler toute la commande',
    'basket.bestMatch': 'Meilleure correspondance',
    'basket.alternativeSelected': 'alternative sélectionnée',
    'basket.buffer': 'marge',
    'basket.cancel': 'Annuler',
    'basket.refund': 'Rembourser',
    'basket.cheapest': 'Moins cher',
    'basket.chooseOne': 'Choisissez 1',
    'basket.addToCompleteDeal': 'pour compléter cette offre',
    'basket.chooseItem': 'Choisir un article',
    'basket.addSave': 'Ajouter et économiser',
    'basket.completeDeal': 'Compléter',
    'basket.chooseInStock': 'Choisissez un article disponible de',
    'basket.dealDiscount': 'Réduction de l’offre',
    'basket.totalDealSavings': 'Économies totales appliquées',
    'basket.totalToPay': 'Total à payer',
    'basket.cardPreAuth': 'Préautorisation de carte',
    'basket.estimated': 'estim.',
    'basket.preAuthNotice': 'Votre moyen de paiement est autorisé pour le total estimé. Seuls les articles confirmés et préparés sont débités; toute différence est libérée immédiatement.',
    'basket.reviewResolve': 'Vérifier les articles au paiement',
    'basket.goCheckout': 'Passer au paiement',
    'basket.hfssTitle': 'Conformité britannique des promotions alimentaires (HFSS)',
    'basket.hfssNotice': 'opportunité d’offre supprimée des recommandations conformément aux règles britanniques sur la promotion et le placement des aliments, car l’article est riche en graisse, sucre ou sel.',
    'basket.item': 'Article du panier',
    'basket.ifItemUnavailable': 'Si cet article est indisponible',
    'basket.unavailablePreferenceHelp': 'Choisissez ce que le magasin doit faire avec cet article pendant la préparation.',
    'basket.substituteBestMatch': 'Remplacer si indisponible (meilleure correspondance)',
    'basket.cheapestOption': 'Option la moins chère',
    'basket.bestMatchHelp': 'Le magasin ne pourra le remplacer que par un article de même prix ou moins cher. Vous bénéficiez du prix le plus bas.',
    'basket.preChooseSubstitute': 'Choisir un substitut à l’avance',
    'basket.bufferAdjusted': 'Marge ajustée',
    'basket.preChooseHelp': 'Choisissez 1 alternative. Si elle coûte plus cher, ce montant est inclus dans la marge de préautorisation de votre carte.',
    'basket.sameOrCheaper': 'Même prix ou moins cher',
    'basket.change': 'Modifier',
    'basket.selectAlternative': 'Sélectionner 1 alternative',
    'basket.preAuthBufferUpdate': 'Mise à jour de la marge de préautorisation',
    'basket.extra': 'Supplément',
    'basket.bufferNoticeSuffix': 'sera réservé sur votre carte. Si l’alternative est préparée, vous payez ce prix; si l’article original est disponible, vous payez le prix original.',
    'basket.chooseAlternativeProduct': 'Choisir un produit alternatif',
    'basket.searchAlternatives': 'Rechercher des alternatives...',
    'basket.noPriceDifference': 'aucune différence de prix',
    'basket.removeIfUnavailable': 'Supprimer si indisponible',
    'basket.autoRefund': 'Remboursement automatique',
    'basket.removeUnavailableHelp': 'Le magasin supprimera cet article uniquement s’il est indisponible. Le montant complet sera remboursé.',
    'basket.cancelIfUnavailable': 'Annuler toute la commande si indisponible',
    'basket.essentialItem': 'Article essentiel',
    'basket.cancelUnavailableHelp': 'Si cet article est indisponible, la commande ne sera pas livrée. Elle sera annulée sans frais.',
    'basket.update': 'Mettre à jour',

    'checkout.title': 'Commande & Autorisation',
    'checkout.scheduling': 'Créneau de livraison',
    'checkout.asap': 'Dès que possible',
    'checkout.scheduled': 'Créneau programmé',
    'checkout.selectSlot': 'Sélectionnez un créneau',
    'checkout.substitutionPreferences': 'Choix de substitution',
    'checkout.subBestMatch': 'Meilleure correspondance',
    'checkout.subCustomerSelected': 'Substitut choisi par vous',
    'checkout.subDoNotSubstitute': 'Ne pas remplacer',
    'checkout.subRemoveUnavailable': 'Supprimer si indisponible',
    'checkout.subCancelOrder': 'Annuler la commande si absent',
    'checkout.lowerPriceGuarantee': 'Garantie prix le plus bas: si le substitut est plus cher, vous payez le prix initial.',
    'checkout.authNoticeTitle': 'Modèle de pré-autorisation',
    'checkout.authNoticeDesc': 'Vous n\'êtes pas débité immédiatement. Nous pré-autorisons le total estimé et le règlement n\'a lieu qu\'après préparation.',
    'checkout.authorizeAndSubmit': 'Autoriser et Valider',
    'checkout.authorizing': 'Autorisation en cours...',
    'checkout.noRawCardExposure': 'Tokenisé PCI • Données bancaires sécurisées',
    'checkout.orderTracking': 'Suivi de commande',
    'checkout.hostedCheckout': 'Paiement hébergé Deliverect Pay',
    'checkout.confirmingOrder': 'Confirmation de la commande',
    'checkout.secureCheckout': 'Paiement sécurisé',
    'checkout.deliveryAddress': 'Adresse de livraison',
    'checkout.noDeliveryAddress': 'Aucune adresse de livraison fournie',
    'checkout.fulfillmentMethod': 'Mode de retrait/livraison',
    'checkout.inStoreCollection': 'Retrait en magasin',
    'checkout.selectedStore': 'Magasin sélectionné',
    'checkout.fulfillingStore': 'Magasin préparateur',
    'checkout.immediatePriority': 'Priorité immédiate',
    'checkout.preOrderSlot': 'Créneau de précommande',
    'checkout.asapCollection': 'Retrait dès que possible',
    'checkout.asapDelivery': 'Livraison dès que possible',
    'checkout.scheduledSlot': 'Créneau programmé',
    'checkout.selectDateTime': 'Sélectionner date/heure',
    'checkout.selectReservationWindow': 'Sélectionner un créneau',
    'checkout.bestMatchGuarantee': 'Garantie meilleur choix : vous payez toujours le prix le plus bas.',
    'checkout.chooseOutOfStock': 'Choisissez quoi faire si un article est indisponible en magasin.',
    'checkout.contactDetails': 'Coordonnées',
    'checkout.contactDetailsHelp': 'Le magasin les utilise pour cette commande. Indiquez un nom et un e-mail ou téléphone.',
    'checkout.name': 'Nom',
    'checkout.email': 'E-mail',
    'checkout.phone': 'Téléphone',
    'checkout.namePlaceholder': 'Nom pour le retrait',
    'checkout.tipCourier': 'Pourboire au livreur (100% pour le chauffeur)',
    'checkout.none': 'Aucun',
    'checkout.promoCode': 'Code promo ou cadeau',
    'checkout.promoPlaceholder': 'ex. SAVE5 ou FREEDELIV',
    'checkout.apply': 'Appliquer',
    'checkout.applying': 'Application…',
    'checkout.payableTotal': 'Total à payer',
    'checkout.collectionOrder': 'Commande à retirer',
    'checkout.collectionNotice': 'Cette commande de retrait est envoyée directement au magasin. Aucune préautorisation, capture de paiement ou livraison par coursier n’est créée.',
    'checkout.paymentModel': 'Modèle de paiement courses',
    'checkout.placingCollection': 'Envoi de la commande de retrait…',
    'checkout.resolveStock': 'Résolvez les articles en rupture ci-dessus',
    'checkout.collectionIssue': 'Problème de retrait — réessayez ci-dessus',
    'checkout.dispatchUnavailable': 'Livraison indisponible — réessayez ci-dessus',
    'checkout.placeCollection': 'Passer la commande à retirer',
    'checkout.hostedPayAlternative': 'Ou utiliser la session hébergée Deliverect Pay',
    'checkout.collectionNoPayment': 'Aucune autorisation de paiement ni coursier pour le retrait',
    'checkout.secureCardNotice': 'Aucune donnée carte exposée • Préautorisation PCI tokenisée',
    'checkout.hostedSession': 'Session hébergée Deliverect Pay',
    'checkout.processingOrder': 'Traitement de la commande',
    'checkout.orderConfirmed': 'Commande confirmée',
    'checkout.loadingTracking': 'Chargement du suivi…',
    'checkout.closeConfirmed': 'Fermer — la commande restera confirmée',
    'checkout.amountDue': 'Montant dû',
    'checkout.supportedWallets': 'Portefeuilles compatibles',
    'checkout.completePayment': 'Finaliser le paiement avec Deliverect Pay',
    'checkout.cancelReturn': 'Annuler et revenir au panier',

    'order.statusAccepted': 'Commande acceptée',
    'order.statusPicking': 'Préparation en cours',
    'order.statusPickingWithChanges': 'Préparé avec substitutions',
    'order.statusPaymentFinalising': 'Ré-autorisation requise',
    'order.statusReadyCourier': 'Emballé, en attente du livreur',
    'order.statusCourierAssigned': 'Livreur assigné',
    'order.statusCourierAtStore': 'Colis récupéré par le livreur',
    'order.statusOutForDelivery': 'En cours de livraison',
    'order.statusDelivered': 'Livré • Bon appétit',
    'order.statusCancelled': 'Commande annulée',
    'order.itemPicked': 'Préparé',
    'order.itemSubstituted': 'Remplacé',
    'order.itemQuantityAmended': 'Quantité ajustée',
    'order.itemRemoved': 'Épuisé',
    'order.reauthorizeRequired': 'Le montant final dépasse le plafond pré-autorisé.',
    'order.approveReauth': 'Approuver le nouveau total',

    'product.closeDetails': 'Fermer les détails du produit',
    'product.noImage': 'Image indisponible',
    'product.includesDeposit': 'Inclut une consigne DRS remboursable de {amount}',
    'product.caloriesEnergy': 'Calories / Énergie',
    'product.fat': 'Matières grasses',
    'product.carbs': 'Glucides',
    'product.protein': 'Protéines',
    'product.sugars': 'Sucres',
    'product.salt': 'Sel',
    'product.netQuantity': 'Quantité nette',
    'product.storageInstructions': 'Conseils de conservation',
    'product.manufacturerOrigin': 'Fabricant et origine',
    'product.manufacturer': 'Opérateur / Fabricant',
    'product.countryOrigin': 'Pays d’origine',
    'product.alcoholDetails': 'Alcool et licence',
    'product.legalNotice': 'Mention légale',
    'product.age18Notice': 'Réservé aux 18 ans et plus. Une vérification d’identité peut être demandée.',
    'product.depositScheme': 'Système de consigne (DRS)',
    'product.depositNotice': 'Le prix comprend une consigne remboursable pour le contenant.',
    'product.total': 'Total',
    'product.chooseStore': 'Choisir un magasin pour commander',
    'product.addToBasket': 'Ajouter au panier',
    'product.specialOffer': 'Offre spéciale',
    'product.priceUnavailable': 'Prix indisponible',
    'product.outOfStockNearby': 'Actuellement indisponible à proximité. Consultez la disponibilité par magasin.',
    'product.availableAllStores': 'Disponible dans les {count} magasins. Consultez les prix par magasin.',
    'product.availableSomeStores': 'Disponible dans {available} magasins sur {total}. Consultez les prix par magasin.',
    'product.compareStores': 'Comparer les magasins',
    'product.description': 'Description',
    'product.allergenInformation': 'Informations allergènes',
    'product.ingredients': 'Ingrédients',
    'product.nutritionalValues': 'Valeurs nutritionnelles',
    'product.dietaryLifestyle': 'Alimentation & mode de vie',
    'product.outOfStock': 'Rupture de stock',
    'orders.title': 'Vos commandes et livraisons',
    'orders.refresh': 'Actualiser',
    'orders.recentActivity': 'Activité récente',
    'orders.noActive': 'Aucune commande active',
    'orders.emptyLive': 'Vos commandes actuelles et passées apparaîtront ici.',
    'orders.actionRequired': 'Action requise',
    'orders.item': 'article',
    'orders.items': 'articles',
    'orders.withSubstitutions': 'avec substitutions',
    'orders.payment': 'Paiement',
    'orders.pending': 'En attente',
    'orders.trackOrder': 'Suivre la commande',
    'orders.paymentAuthorized': 'Autorisé',
    'orders.paymentCaptured': 'Débité',
    'orders.paymentActionRequired': 'Action requise',
    'orders.paymentTokenized': 'Carte enregistrée de façon sécurisée',
    'order.statusSubmitted': 'Commande envoyée',
    'order.statusPickedPacked': 'Articles préparés',
    'order.statusReadyCollection': 'Prêt pour le retrait',

    'tracking.allOrders': 'Toutes les commandes',
    'tracking.courierDelivery': 'Livraison par coursier',
    'tracking.storeCollection': 'Retrait en magasin',
    'tracking.scheduled': 'Programmé',
    'tracking.asapDelivery': 'Livraison au plus vite',
    'tracking.finalChargedTotal': 'Total final / débité',
    'tracking.orderCancelled': 'Commande annulée',
    'tracking.cancelledFallback': 'Cette commande a été annulée car un article requis était indisponible, conformément à vos préférences de substitution.',
    'tracking.paymentHoldReleased': 'La préautorisation de paiement a été entièrement libérée. Aucun montant n’a été débité.',
    'tracking.reauthRequired': 'Nouvelle autorisation de paiement requise',
    'tracking.reauthPrefix': 'Pendant la préparation, les substitutions ou ajustements de poids ont porté le total final à',
    'tracking.reauthExceeds': 'ce qui dépasse votre plafond approuvé de',
    'tracking.reauthSuffix': 'Vérifiez et approuvez le nouveau total pour poursuivre la livraison.',
    'tracking.authorizing': 'Autorisation...',
    'tracking.approvePay': 'Approuver et payer',
    'tracking.lifecycleTitle': 'Cycle de la commande',
    'tracking.lifecycleNotice': 'Vous n’êtes jamais débité immédiatement. Le paiement n’est capturé qu’après la préparation en magasin, avec notre garantie du meilleur prix.',
    'tracking.pickingItems': 'Articles en préparation',
    'tracking.timeline': 'Chronologie',
    'tracking.paymentAuthorization': 'Paiement et autorisation',
    'tracking.storePickingState': 'État de préparation',
    'tracking.status': 'État',
    'tracking.substituted': 'Remplacé',
    'tracking.quantityAdjusted': 'Quantité ajustée',
    'tracking.outOfStockRefunded': 'Indisponible • Remboursé',
    'tracking.picked': 'Préparé',
    'tracking.awaitingPicker': 'En attente de préparation',
    'tracking.requested': 'Demandé',
    'tracking.supplied': 'Fourni',
    'tracking.substitute': 'Substitut',
    'tracking.shelf': 'Prix en rayon',
    'tracking.youPay': 'Vous payez',
    'tracking.note': 'Note',
    'tracking.was': 'avant',
    'tracking.paymentBreakdown': 'Détail du paiement',
    'tracking.originalEstimate': 'Estimation initiale du panier',
    'tracking.approvedCeiling': 'Plafond approuvé par le client',
    'tracking.deliveryCharge': 'Frais de livraison',
    'tracking.bagServiceFees': 'Sacs et frais de service',
    'tracking.finalCaptured': 'Montant final débité',
    'tracking.auditHistory': 'Historique des états',
    'tracking.cardTokenized': 'Carte tokenisée',
    'tracking.preAuthorizedEstimated': 'Préautorisé (estimé)',
    'tracking.actionReauthorize': 'Action requise : réautoriser',
    'tracking.finalTotalCaptured': 'Total final débité',
    'tracking.pending': 'En attente',
    'tracking.by': 'de',
    'tracking.eta': 'Heure estimée',

    'error.general': 'Une erreur inattendue est survenue.',
    'error.stockDepleted': 'Le produit sélectionné est en rupture de stock.',
    'error.noServiceableStore': 'Aucun magasin disponible pour cette adresse.',
    'error.paymentDeclined': 'Autorisation de paiement refusée.',
    'error.mediaFailed': 'Impossible de charger le fichier multimédia.',

    'fav.emptyTitle': 'Aucun favori pour l\'instant',
    'fav.emptySubtitle': 'Cliquez sur le cœur pour enregistrer vos produits préférés.',
    'fav.reorderAll': 'Commander tous les disponibles',
    'fav.revalidating': 'Vérification de la disponibilité...',
    'fav.addedToBasket': 'Ajouté au panier',
    'search.placeholder': 'Rechercher produits, marques, codes-barres ou tags…',
    'search.trending': 'Recherches populaires',
    'search.searching': 'Recherche dans le catalogue…',
    'search.foundItem': 'article',
    'search.foundItems': 'articles',
    'search.forQuery': 'pour',
    'search.multiStore': 'Disponibilité multi-magasins affichée',
    'search.noResults': 'Aucun produit correspondant',
    'search.noResultsHint': 'Essayez un autre produit, une marque ou une catégorie.',
    'aisles.all': 'Tous les rayons',
    'aisles.allCategoryPrefix': 'Tout',
    'aisles.browsingStore': 'Navigation dans',
    'aisles.selectShelf': 'Sélectionnez un rayon ou une catégorie',
    'aisles.searchPlaceholder': 'Rechercher rayons, lait, boulangerie, fruits…',
    'aisles.back': 'Retour',
    'aisles.viewAllIn': 'Tout voir dans',
    'aisles.browseEntire': 'Parcourir tout le catalogue sans filtre de catégorie',
    'aisles.selected': 'Sélectionné',
    'aisles.noMatching': 'Aucun rayon correspondant à',
    'aisles.trySearchHint': 'Essayez une autre catégorie ou un autre type de produit.',
    'aisles.clearSearch': 'Effacer la recherche',
    'aisles.item': 'article',
    'aisles.items': 'articles',
    'aisles.searchAisles': 'Rechercher les rayons',
    'aisles.parentAisle': 'Rayon parent',
    'aisles.more': 'Plus',
    'aisles.category': 'Catégorie',
    'aisles.productsSearchPlaceholder': 'Rechercher produits et rayons…',
  },

  'de-DE': {
    'nav.home': 'Startseite',
    'nav.search': 'Suche',
    'nav.orders': 'Bestellungen',
    'nav.account': 'Konto',
    'nav.aisles': 'Abteilungen',
    'nav.favourites': 'Favoriten',
    'nav.buyAgain': 'Wieder bestellen',
    'nav.admin': 'Admin-Konsole',

    'header.deliveringTo': 'Lieferung an',
    'header.collectFrom': 'Abholung bei',
    'header.changeLocation': 'Ändern',
    'header.selectStore': 'Filiale wählen',
    'header.openStores': 'Geöffnete Filialen in der Nähe',
    'header.closedStoreNotice': 'Derzeit geschlossen',
    'header.acceptsPreOrders': 'Vorbestellungen für geplante Lieferung möglich',
    'header.setLocation': 'Standort festlegen',
    'header.allStores': 'Alle Filialen',
    'header.delivery': 'Lieferung',
    'header.collect': 'Abholung',
    'header.deliveryOnly': 'Nur Lieferung',
    'header.profilePreferences': 'Profil & Einstellungen',
    'header.ordersTracking': 'Bestellungen & Tracking',
    'header.basket': 'Warenkorb',
    'fulfilment.title': 'Wie möchtest du deine Bestellung erhalten?',
    'fulfilment.subtitle': 'Wähle Lieferung an die Tür oder Abholung in der Filiale',
    'fulfilment.deliverTo': 'Liefern an',
    'fulfilment.delivery': 'Lieferung an die Tür',
    'fulfilment.collection': 'Click & Collect',
    'location.deliveryAddress': 'Lieferadresse',
    'location.liveRouting': 'Live-Entfernung und Route',
    'location.map': 'Karte',
    'location.list': 'Liste',
    'fulfilment.comingSoon': 'Demnächst',
    'fulfilment.available': 'Verfügbar',
    'fulfilment.limitedZone': 'Begrenztes Gebiet',
    'fulfilment.notAvailableYet': 'Noch nicht verfügbar — bitte Click & Collect wählen',
    'fulfilment.storeDelivers': 'Filiale in der Nähe liefert an deine Adresse',
    'fulfilment.storesDeliver': 'Filialen in der Nähe liefern an deine Adresse',
    'fulfilment.collectionAvailable': 'Abholung in Filialen in der Nähe verfügbar',
    'fulfilment.free': 'Kostenlos',
    'fulfilment.localBranch': 'lokale Filiale',
    'fulfilment.localBranches': 'lokale Filialen',
    'location.selectedLocation': 'Ausgewählter Standort',
    'location.hideMap': 'Karte ausblenden',
    'location.showMap': 'Karte anzeigen',
    'location.locating': 'Standort wird ermittelt…',
    'location.useCurrentLocation': 'Aktuellen Standort verwenden',
    'location.savedAddresses': 'Gespeicherte Adressen',
    'location.confirmContinue': 'Bestätigen & fortfahren',

    'account.languageRegion': 'Sprache & Region',
    'account.savedAddresses': 'Gespeicherte Lieferadressen',
    'account.paymentMethods': 'Zahlungsmethoden',
    'account.notifications': 'Bestell- und Lieferbenachrichtigungen',
    'account.brandInfoPolicies': 'Markeninformationen & Richtlinien',
    'account.signIn': 'Anmelden',
    'account.signOut': 'Abmelden',
    'account.notSignedIn': 'Nicht angemeldet',
    'account.verifiedAccount': 'Verifiziertes Konto',
    'account.guestSession': 'Gast-Sitzung',
    'account.customerSupport': 'Kundensupport',
    'account.supportEmailMissing': 'Support-E-Mail nicht konfiguriert',
    'account.supportPhoneMissing': 'Support-Telefon nicht konfiguriert',
    'account.supportHours': 'Zeiten',
    'account.supportHoursFallback': 'Öffnungszeiten findest du in den Filialinformationen',
    'account.operationsPortal': 'Marken-Betriebsportal',
    'account.operationsPortalDescription': 'Gebühren, Regeln, Stories, Branding & Insights verwalten',
    'account.launchAdmin': 'Admin öffnen',
    'account.signInToManage': 'Melde dich an, um Kontoeinstellungen zu verwalten.',
    'account.noSavedAddresses': 'Für dieses Konto sind noch keine Lieferadressen gespeichert.',
    'account.paymentProviderNote': 'Zahlungsmethoden werden beim Checkout sicher erfasst und nur angezeigt, wenn der Zahlungsanbieter gespeicherte Methoden unterstützt.',
    'account.notificationNote': 'Bestellupdates verwenden die für die jeweilige Bestellung verfügbaren Kontaktdaten und Benachrichtigungskanäle.',
    'account.noPolicies': 'Für diese Sprache sind noch keine Informations- oder Richtlinienseiten veröffentlicht.',

    'basket.title': 'Dein Warenkorb',
    'basket.emptyTitle': 'Dein Warenkorb ist leer',
    'basket.emptySubtitle': 'Füge frische Lebensmittel hinzu, um loszulegen.',
    'basket.startShopping': 'Einkauf starten',
    'basket.subtotal': 'Zwischensumme',
    'basket.deliveryFee': 'Liefergebühr',
    'basket.serviceFee': 'Service & Verpackung',
    'basket.bagFee': 'Tüten',
    'basket.deposit': 'Flaschenpfand (DRS)',
    'basket.discount': 'Rabatt',
    'basket.tip': 'Trinkgeld',
    'basket.total': 'Geschätzter Gesamtbetrag',
    'basket.checkoutBtn': 'Zur Kasse',
    'basket.clearBasket': 'Warenkorb leeren',
    'basket.youMayHaveForgotten': 'Vielleicht hast du vergessen...',
    'basket.saving': 'Ersparnis',
    'basket.selectedStore': 'Ausgewählte Filiale',
    'basket.unavailableAtStore': 'Artikel in dieser Filiale nicht verfügbar',
    'basket.swapAllInStock': 'Alle durch verfügbare Artikel ersetzen',
    'basket.stockCheckNotice': 'Die Live-Bestandsprüfung hat pausierte oder ausverkaufte Artikel gefunden. Du kannst sie durch verfügbare Alternativen ersetzen oder entfernen.',
    'basket.comboDeal': 'Kombi-Angebot',
    'basket.quantityUnavailable': 'Menge nicht verfügbar',
    'basket.snoozedByStore': 'Von der Filiale pausiert',
    'basket.unavailableHere': 'In dieser Filiale nicht verfügbar',
    'basket.each': 'je',
    'basket.drsDeposit': 'DRS-Pfand',
    'basket.inStockSubstitute': 'Verfügbarer Ersatzartikel',
    'basket.swap': 'Ersetzen',
    'basket.ifUnavailable': 'Wenn nicht verfügbar',
    'basket.preChosenSubstitute': 'Gewählter Ersatz',
    'basket.removeItem': 'Artikel entfernen',
    'basket.cancelEntireOrder': 'Gesamte Bestellung stornieren',
    'basket.bestMatch': 'Beste Übereinstimmung',
    'basket.alternativeSelected': 'Alternative ausgewählt',
    'basket.buffer': 'Puffer',
    'basket.cancel': 'Stornieren',
    'basket.refund': 'Erstatten',
    'basket.cheapest': 'Günstigste Option',
    'basket.chooseOne': 'Wähle 1',
    'basket.addToCompleteDeal': 'um dieses Angebot abzuschließen',
    'basket.chooseItem': 'Artikel wählen',
    'basket.addSave': 'Hinzufügen & sparen',
    'basket.completeDeal': 'Vervollständigen',
    'basket.chooseInStock': 'Wähle einen verfügbaren Artikel aus',
    'basket.dealDiscount': 'Angebotsrabatt',
    'basket.totalDealSavings': 'Gesamte Angebotsersparnis',
    'basket.totalToPay': 'Zu zahlender Gesamtbetrag',
    'basket.cardPreAuth': 'Kartenvorautorisierung',
    'basket.estimated': 'gesch.',
    'basket.preAuthNotice': 'Deine Zahlungsmethode wird für den geschätzten Gesamtbetrag autorisiert. Belastet wird nur, was in der Filiale bestätigt und kommissioniert wurde; die Differenz wird sofort freigegeben.',
    'basket.reviewResolve': 'Artikel beim Checkout prüfen',
    'basket.goCheckout': 'Zum Checkout',
    'basket.hfssTitle': 'Britische Lebensmittel-Promotionsregeln (HFSS)',
    'basket.hfssNotice': 'Angebotsmöglichkeit wurde gemäß den britischen Regeln zur Lebensmittelpromotion und -platzierung aus den Empfehlungen entfernt, da der Artikel viel Fett, Zucker oder Salz enthält.',
    'basket.item': 'Warenkorbartikel',
    'basket.ifItemUnavailable': 'Wenn dieser Artikel nicht verfügbar ist',
    'basket.unavailablePreferenceHelp': 'Wähle, wie die Filiale während der Kommissionierung mit diesem Artikel umgehen soll.',
    'basket.substituteBestMatch': 'Bei Nichtverfügbarkeit ersetzen (beste Übereinstimmung)',
    'basket.cheapestOption': 'Günstigste Option',
    'basket.bestMatchHelp': 'Die Filiale darf nur gegen einen gleich teuren oder günstigeren Artikel tauschen. Du erhältst garantiert den niedrigeren Preis.',
    'basket.preChooseSubstitute': 'Ersatzartikel vorab wählen',
    'basket.bufferAdjusted': 'Puffer angepasst',
    'basket.preChooseHelp': 'Wähle 1 Alternative. Ist sie teurer, wird der höhere Betrag in den Vorautorisierungspuffer deiner Karte eingerechnet.',
    'basket.sameOrCheaper': 'Gleich teuer oder günstiger',
    'basket.change': 'Ändern',
    'basket.selectAlternative': '1 Alternative auswählen',
    'basket.preAuthBufferUpdate': 'Aktualisierung des Vorautorisierungspuffers',
    'basket.extra': 'Zusätzlich',
    'basket.bufferNoticeSuffix': 'wird auf deiner Karte reserviert. Wird die Alternative kommissioniert, zahlst du diesen Preis; ist der Originalartikel verfügbar, zahlst du den Originalpreis.',
    'basket.chooseAlternativeProduct': 'Alternativprodukt wählen',
    'basket.searchAlternatives': 'Alternativen suchen...',
    'basket.noPriceDifference': 'kein Preisunterschied',
    'basket.removeIfUnavailable': 'Bei Nichtverfügbarkeit entfernen',
    'basket.autoRefund': 'Automatische Erstattung',
    'basket.removeUnavailableHelp': 'Die Filiale entfernt den Artikel nur, wenn er nicht verfügbar ist. Der volle Betrag wird erstattet.',
    'basket.cancelIfUnavailable': 'Gesamte Bestellung stornieren, wenn nicht verfügbar',
    'basket.essentialItem': 'Wichtiger Artikel',
    'basket.cancelUnavailableHelp': 'Ist dieser Artikel nicht verfügbar, wird die gesamte Bestellung ohne Belastung storniert.',
    'basket.update': 'Aktualisieren',

    'checkout.title': 'Kasse & Autorisierung',
    'checkout.scheduling': 'Lieferzeitpunkt',
    'checkout.asap': 'Schnellstmögliche Lieferung',
    'checkout.scheduled': 'Geplantes Zeitfenster',
    'checkout.selectSlot': 'Wähle ein Lieferfenster',
    'checkout.substitutionPreferences': 'Ersatzartikel-Präferenz',
    'checkout.subBestMatch': 'Beste Übereinstimmung',
    'checkout.subCustomerSelected': 'Vom Kunden gewählter Ersatz',
    'checkout.subDoNotSubstitute': 'Nicht ersetzen',
    'checkout.subRemoveUnavailable': 'Entfernen wenn nicht verfügbar',
    'checkout.subCancelOrder': 'Bestellung stornieren wenn nicht da',
    'checkout.lowerPriceGuarantee': 'Niedrigpreisgarantie: Kostet der Ersatzartikel mehr, zahlst du nur den ursprünglichen Preis.',
    'checkout.authNoticeTitle': 'Vorautorisierungsmodell',
    'checkout.authNoticeDesc': 'Du wirst nicht sofort belastet. Wir autorisieren den geschätzten Betrag vor und buchen erst nach der Kommissionierung ab.',
    'checkout.authorizeAndSubmit': 'Autorisieren & Bestellen',
    'checkout.authorizing': 'Autorisierung läuft...',
    'checkout.noRawCardExposure': 'PCI-Tokenisierung • Keine Kartendaten auf dem Client',
    'checkout.orderTracking': 'Bestellverfolgung',
    'checkout.hostedCheckout': 'Deliverect Pay Bezahlseite',
    'checkout.confirmingOrder': 'Bestellung wird bestätigt',
    'checkout.secureCheckout': 'Sicherer Checkout',
    'checkout.deliveryAddress': 'Lieferadresse',
    'checkout.noDeliveryAddress': 'Keine Lieferadresse angegeben',
    'checkout.fulfillmentMethod': 'Erfüllungsart',
    'checkout.inStoreCollection': 'Abholung in der Filiale',
    'checkout.selectedStore': 'Ausgewählte Filiale',
    'checkout.fulfillingStore': 'Ausführende Filiale',
    'checkout.immediatePriority': 'Sofortige Priorität',
    'checkout.preOrderSlot': 'Vorbestell-Zeitfenster',
    'checkout.asapCollection': 'Schnellstmögliche Abholung',
    'checkout.asapDelivery': 'Schnellstmögliche Lieferung',
    'checkout.scheduledSlot': 'Geplantes Zeitfenster',
    'checkout.selectDateTime': 'Datum/Uhrzeit auswählen',
    'checkout.selectReservationWindow': 'Zeitfenster auswählen',
    'checkout.bestMatchGuarantee': 'Best-Match-Preisgarantie: Du zahlst immer den niedrigeren Preis.',
    'checkout.chooseOutOfStock': 'Lege fest, was die Filiale bei nicht verfügbaren Artikeln tun soll.',
    'checkout.contactDetails': 'Kontaktdaten',
    'checkout.contactDetailsHelp': 'Die Filiale nutzt sie für diese Bestellung. Gib einen Namen sowie E-Mail oder Telefonnummer an.',
    'checkout.name': 'Name',
    'checkout.email': 'E-Mail',
    'checkout.phone': 'Telefon',
    'checkout.namePlaceholder': 'Name für die Abholung',
    'checkout.tipCourier': 'Trinkgeld für den Kurier (100% für den Fahrer)',
    'checkout.none': 'Keins',
    'checkout.promoCode': 'Promo- oder Gutscheincode',
    'checkout.promoPlaceholder': 'z. B. SAVE5 oder FREEDELIV',
    'checkout.apply': 'Anwenden',
    'checkout.applying': 'Wird angewendet…',
    'checkout.payableTotal': 'Zu zahlender Gesamtbetrag',
    'checkout.collectionOrder': 'Abholbestellung',
    'checkout.collectionNotice': 'Diese Abholbestellung wird direkt an die Filiale gesendet. Es werden keine Karten-Vorautorisierung, Zahlungserfassung oder Kurierzustellung erstellt.',
    'checkout.paymentModel': 'Zahlungsmodell für Lebensmittel',
    'checkout.placingCollection': 'Abholbestellung wird aufgegeben…',
    'checkout.resolveStock': 'Nicht verfügbare Artikel oben klären',
    'checkout.collectionIssue': 'Problem mit Abholung — oben erneut versuchen',
    'checkout.dispatchUnavailable': 'Kurier nicht verfügbar — oben erneut versuchen',
    'checkout.placeCollection': 'Abholbestellung aufgeben',
    'checkout.hostedPayAlternative': 'Oder Deliverect Pay Bezahlseite verwenden',
    'checkout.collectionNoPayment': 'Keine Zahlungsautorisierung oder Kurierzustellung bei Abholung',
    'checkout.secureCardNotice': 'Keine Kartendaten offengelegt • PCI-tokenisierte Vorautorisierung',
    'checkout.hostedSession': 'Deliverect Pay Bezahlseite',
    'checkout.processingOrder': 'Bestellung wird verarbeitet',
    'checkout.orderConfirmed': 'Bestellung bestätigt',
    'checkout.loadingTracking': 'Bestellverfolgung wird geladen…',
    'checkout.closeConfirmed': 'Schließen — Bestellung bleibt bestätigt',
    'checkout.amountDue': 'Fälliger Betrag',
    'checkout.supportedWallets': 'Unterstützte Wallets',
    'checkout.completePayment': 'Zahlung mit Deliverect Pay abschließen',
    'checkout.cancelReturn': 'Abbrechen & zum Warenkorb',

    'order.statusAccepted': 'Bestellung angenommen',
    'order.statusPicking': 'Kommissionierung läuft',
    'order.statusPickingWithChanges': 'Mit Ersatzartikeln kommissioniert',
    'order.statusPaymentFinalising': 'Re-Autorisierung erforderlich',
    'order.statusReadyCourier': 'Gepackt, wartet auf Kurier',
    'order.statusCourierAssigned': 'Kurier zugewiesen',
    'order.statusCourierAtStore': 'Kurier hat Bestellung abgeholt',
    'order.statusOutForDelivery': 'In Zustellung',
    'order.statusDelivered': 'Zugestellt • Guten Appetit',
    'order.statusCancelled': 'Bestellung storniert',
    'order.itemPicked': 'Kommissioniert',
    'order.itemSubstituted': 'Ersetzt',
    'order.itemQuantityAmended': 'Menge angepasst',
    'order.itemRemoved': 'Ausverkauft',
    'order.reauthorizeRequired': 'Endbetrag übersteigt vorautorisiertes Limit.',
    'order.approveReauth': 'Neuen Gesamtbetrag bestätigen',

    'product.closeDetails': 'Produktdetails schließen',
    'product.noImage': 'Kein Bild verfügbar',
    'product.includesDeposit': 'Enthält {amount} erstattungsfähiges DRS-Pfand',
    'product.caloriesEnergy': 'Kalorien / Energie',
    'product.fat': 'Fett',
    'product.carbs': 'Kohlenhydrate',
    'product.protein': 'Eiweiß',
    'product.sugars': 'Zucker',
    'product.salt': 'Salz',
    'product.netQuantity': 'Nettomenge',
    'product.storageInstructions': 'Lagerhinweise',
    'product.manufacturerOrigin': 'Hersteller & Herkunft',
    'product.manufacturer': 'Lebensmittelunternehmer / Hersteller',
    'product.countryOrigin': 'Herkunftsland',
    'product.alcoholDetails': 'Alkohol & Lizenzhinweise',
    'product.legalNotice': 'Rechtlicher Hinweis',
    'product.age18Notice': 'Nur ab 18 Jahren. Eine Ausweiskontrolle kann erforderlich sein.',
    'product.depositScheme': 'Pfand- und Rückgabesystem (DRS)',
    'product.depositNotice': 'Der Preis enthält ein erstattungsfähiges Behälterpfand.',
    'product.total': 'Gesamt',
    'product.chooseStore': 'Filiale zum Bestellen wählen',
    'product.addToBasket': 'In den Warenkorb',
    'product.specialOffer': 'Sonderangebot',
    'product.priceUnavailable': 'Preis nicht verfügbar',
    'product.outOfStockNearby': 'In der Nähe derzeit ausverkauft. Filialverfügbarkeit ansehen.',
    'product.availableAllStores': 'In allen {count} Filialen verfügbar. Preise je Filiale ansehen.',
    'product.availableSomeStores': 'In {available} von {total} Filialen verfügbar. Preise je Filiale ansehen.',
    'product.compareStores': 'Filialen vergleichen',
    'product.description': 'Beschreibung',
    'product.allergenInformation': 'Allergeninformationen',
    'product.ingredients': 'Zutaten',
    'product.nutritionalValues': 'Nährwerte',
    'product.dietaryLifestyle': 'Ernährung & Lebensstil',
    'product.outOfStock': 'Ausverkauft',
    'orders.title': 'Deine Bestellungen & Lieferungen',
    'orders.refresh': 'Aktualisieren',
    'orders.recentActivity': 'Letzte Aktivitäten',
    'orders.noActive': 'Noch keine aktiven Bestellungen',
    'orders.emptyLive': 'Deine aktuellen und früheren Bestellungen erscheinen hier.',
    'orders.actionRequired': 'Aktion erforderlich',
    'orders.item': 'Artikel',
    'orders.items': 'Artikel',
    'orders.withSubstitutions': 'mit Ersatzartikeln',
    'orders.payment': 'Zahlung',
    'orders.pending': 'Ausstehend',
    'orders.trackOrder': 'Bestellung verfolgen',
    'orders.paymentAuthorized': 'Autorisiert',
    'orders.paymentCaptured': 'Abgebucht',
    'orders.paymentActionRequired': 'Aktion erforderlich',
    'orders.paymentTokenized': 'Karte sicher gespeichert',
    'order.statusSubmitted': 'Bestellung gesendet',
    'order.statusPickedPacked': 'Artikel kommissioniert & gepackt',
    'order.statusReadyCollection': 'Bereit zur Abholung',

    'tracking.allOrders': 'Alle Bestellungen',
    'tracking.courierDelivery': 'Kurierlieferung',
    'tracking.storeCollection': 'Abholung in der Filiale',
    'tracking.scheduled': 'Geplant',
    'tracking.asapDelivery': 'Schnellstmögliche Lieferung',
    'tracking.finalChargedTotal': 'Endbetrag / belastet',
    'tracking.orderCancelled': 'Bestellung storniert',
    'tracking.cancelledFallback': 'Diese Bestellung wurde storniert, weil ein erforderlicher Artikel gemäß deinen Ersatzpräferenzen nicht verfügbar war.',
    'tracking.paymentHoldReleased': 'Die Zahlungsreservierung wurde vollständig aufgehoben. Es wurde nichts belastet.',
    'tracking.reauthRequired': 'Erneute Zahlungsautorisierung erforderlich',
    'tracking.reauthPrefix': 'Während der Kommissionierung haben Ersatzartikel oder Gewichtsanpassungen den Endbetrag erhöht auf',
    'tracking.reauthExceeds': 'und damit dein genehmigtes Limit von überschritten',
    'tracking.reauthSuffix': 'Prüfe und bestätige den neuen Betrag, damit die Zustellung fortgesetzt werden kann.',
    'tracking.authorizing': 'Autorisierung...',
    'tracking.approvePay': 'Bestätigen & zahlen',
    'tracking.lifecycleTitle': 'Bestellablauf',
    'tracking.lifecycleNotice': 'Du wirst nicht sofort belastet. Die Zahlung wird erst nach Abschluss der Kommissionierung mit unserer Bestpreisgarantie eingezogen.',
    'tracking.pickingItems': 'Artikel in Kommissionierung',
    'tracking.timeline': 'Zeitachse',
    'tracking.paymentAuthorization': 'Zahlung & Autorisierung',
    'tracking.storePickingState': 'Kommissionierstatus',
    'tracking.status': 'Status',
    'tracking.substituted': 'Ersetzt',
    'tracking.quantityAdjusted': 'Menge angepasst',
    'tracking.outOfStockRefunded': 'Ausverkauft • Erstattet',
    'tracking.picked': 'Kommissioniert',
    'tracking.awaitingPicker': 'Wartet auf Kommissionierung',
    'tracking.requested': 'Bestellt',
    'tracking.supplied': 'Geliefert',
    'tracking.substitute': 'Ersatzartikel',
    'tracking.shelf': 'Regalpreis',
    'tracking.youPay': 'Du zahlst',
    'tracking.note': 'Hinweis',
    'tracking.was': 'vorher',
    'tracking.paymentBreakdown': 'Zahlungsübersicht',
    'tracking.originalEstimate': 'Ursprüngliche Warenkorbschätzung',
    'tracking.approvedCeiling': 'Genehmigtes Kundenlimit',
    'tracking.deliveryCharge': 'Liefergebühr',
    'tracking.bagServiceFees': 'Tüten- & Servicegebühren',
    'tracking.finalCaptured': 'Endgültig belasteter Betrag',
    'tracking.auditHistory': 'Statusverlauf',
    'tracking.cardTokenized': 'Karte tokenisiert',
    'tracking.preAuthorizedEstimated': 'Vorautorisiert (geschätzt)',
    'tracking.actionReauthorize': 'Aktion erforderlich: erneut autorisieren',
    'tracking.finalTotalCaptured': 'Endbetrag belastet',
    'tracking.pending': 'Ausstehend',
    'tracking.by': 'um',
    'tracking.eta': 'Voraussichtliche Zeit',

    'error.general': 'Ein unerwarteter Fehler ist aufgetreten.',
    'error.stockDepleted': 'Artikel in dieser Filiale ausverkauft.',
    'error.noServiceableStore': 'Keine Filiale für diese Adresse verfügbar.',
    'error.paymentDeclined': 'Zahlungsautorisierung abgelehnt.',
    'error.mediaFailed': 'Mediendatei konnte nicht geladen werden.',

    'fav.emptyTitle': 'Noch keine Favoriten',
    'fav.emptySubtitle': 'Klicke auf das Herz, um Artikel für schnelle Nachbestellungen zu speichern.',
    'fav.reorderAll': 'Alle verfügbaren nachbestellen',
    'fav.revalidating': 'Verfügbarkeit wird geprüft...',
    'fav.addedToBasket': 'In den Warenkorb gelegt',
    'search.placeholder': 'Produkte, Marken, Barcodes oder Tags suchen…',
    'search.trending': 'Beliebte Suchanfragen',
    'search.searching': 'Katalog wird durchsucht…',
    'search.foundItem': 'Artikel',
    'search.foundItems': 'Artikel',
    'search.forQuery': 'für',
    'search.multiStore': 'Verfügbarkeit in mehreren Filialen',
    'search.noResults': 'Keine passenden Produkte gefunden',
    'search.noResultsHint': 'Suche nach einem anderen Produkt, einer Marke oder Kategorie.',
    'aisles.all': 'Alle Abteilungen',
    'aisles.allCategoryPrefix': 'Alle',
    'aisles.browsingStore': 'Durchsuchen',
    'aisles.selectShelf': 'Abteilung oder Produktbereich auswählen',
    'aisles.searchPlaceholder': 'Abteilungen, Milch, Backwaren, Obst suchen…',
    'aisles.back': 'Zurück',
    'aisles.viewAllIn': 'Alles anzeigen in',
    'aisles.browseEntire': 'Gesamten Katalog ohne Kategoriefilter durchsuchen',
    'aisles.selected': 'Ausgewählt',
    'aisles.noMatching': 'Keine passenden Abteilungen für',
    'aisles.trySearchHint': 'Versuche eine andere Kategorie oder Produktart.',
    'aisles.clearSearch': 'Suche löschen',
    'aisles.item': 'Artikel',
    'aisles.items': 'Artikel',
    'aisles.searchAisles': 'Abteilungen suchen',
    'aisles.parentAisle': 'Übergeordnete Abteilung',
    'aisles.more': 'Mehr',
    'aisles.category': 'Kategorie',
    'aisles.productsSearchPlaceholder': 'Produkte & Abteilungen suchen…',
  },
};
