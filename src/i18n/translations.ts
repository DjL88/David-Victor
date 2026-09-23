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
  'checkout.itemAvailabilityNotice': string;
  'checkout.swapAllAvailable': string;
  'checkout.availabilityExplanation': string;
  'checkout.temporarilySnoozed': string;
  'checkout.outOfStock': string;
  'checkout.remove': string;
  'checkout.chosenReplacement': string;
  'checkout.substituteAlsoUnavailable': string;
  'checkout.noSubstituteConfigured': string;
  'checkout.chooseSubstitute': string;
  'checkout.deliveryAddress': string;
  'checkout.noDeliveryAddress': string;
  'checkout.fulfilmentMethod': string;
  'checkout.inStoreCollection': string;
  'checkout.selectedStore': string;
  'checkout.fulfillingStore': string;
  'checkout.immediatePriority': string;
  'checkout.preOrderSlot': string;
  'checkout.asapCollection': string;
  'checkout.asapDelivery': string;
  'checkout.eta': string;
  'checkout.scheduledSlot': string;
  'checkout.selectDateTime': string;
  'checkout.selectReservationWindow': string;
  'checkout.subPriceGuarantee': string;
  'checkout.subInstructions': string;
  'checkout.contactDetails': string;
  'checkout.contactDetailsHelp': string;
  'checkout.name': string;
  'checkout.email': string;
  'checkout.phone': string;
  'checkout.namePlaceholder': string;
  'checkout.itemsSubtotal': string;
  'checkout.refundableDeposit': string;
  'checkout.payableTotal': string;
  'checkout.collectionOrder': string;
  'checkout.collectionOrderNotice': string;
  'checkout.paymentModel': string;
  'checkout.hostedPayAlternative': string;
  'checkout.hostedPayTitle': string;
  'checkout.hostedPayDescription': string;
  'checkout.session': string;
  'checkout.brand': string;
  'checkout.amountDue': string;
  'checkout.supportedWallets': string;
  'checkout.completeHostedPayment': string;
  'checkout.cancelReturnBasket': string;
  'checkout.processingOrder': string;
  'checkout.orderConfirmed': string;
  'checkout.orderConfirmedSync': string;
  'checkout.loadingTracking': string;
  'checkout.closeConfirmed': string;
  'checkout.orderUnsuccessful': string;
  'checkout.paymentUnsuccessful': string;
  'checkout.noPaymentTaken': string;
  'checkout.noChargesCaptured': string;
  'checkout.tryOrderAgain': string;
  'checkout.tryPaymentAgain': string;
  'checkout.closeKeepBasket': string;
  'checkout.paymentNoticeStart': string;
  'checkout.paymentNoticeEstimated': string;
  'checkout.paymentNoticeBuffer': string;
  'checkout.paymentNoticeEnd': string;
  'checkout.collectionNoPayment': string;
  'checkout.resolveOutOfStock': string;
  'checkout.collectionIssueRetry': string;
  'checkout.dispatchUnavailableRetry': string;
  'checkout.placeCollectionOrder': string;
  'checkout.authorizeUpTo': string;
  'checkout.recoveringOrder': string;
  'checkout.retryCollectionOrder': string;
  'checkout.checkingAvailability': string;
  'checkout.retryAvailabilityCheck': string;
  'checkout.switchToPickup': string;
  'checkout.availableStoresCouriers': string;
  'checkout.initializingPayment': string;
  'checkout.preparingPayment': string;
  'checkout.paymentGateway': string;
  'checkout.paymentAuthorised': string;
  'checkout.placingOrder': string;
  'checkout.stepPlacingCollection': string;
  'checkout.stepPreparingPayment': string;
  'checkout.stepPaymentAuthorised': string;
  'checkout.stepPlacingOrder': string;
  'checkout.stepOrderConfirmed': string;
  'checkout.chooseOptions': string;
  'checkout.preChosen': string;
  'checkout.removeRefundItem': string;
  'checkout.cancelEntireOrder': string;
  'checkout.bestMatchGuarantee': string;
  'checkout.dispatchQuoteGuaranteed': string;
  'checkout.dispatchQuoteExpired': string;
  'checkout.dispatchConfirmation': string;
  'checkout.checking': string;
  'checkout.recheck': string;
  'checkout.collectionIssue': string;
  'checkout.dispatchUnavailable': string;
  'checkout.partnerStore': string;
  'checkout.switchAndOrder': string;
  'checkout.tipCourier': string;
  'checkout.none': string;
  'checkout.promoGiftCode': string;
  'checkout.applying': string;
  'checkout.apply': string;
  'checkout.placingCollectionOrder': string;
  'checkout.authorizingSubmitting': string;

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

  // Errors & Fallbacks
  'error.general': string;
  'error.stockDepleted': string;
  'error.noServiceableStore': string;
  'error.paymentDeclined': string;
  'error.mediaFailed': string;

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
    'checkout.itemAvailabilityNotice': 'Item Availability & Substitution Notice',
    'checkout.swapAllAvailable': 'Swap All to In-Stock Substitutes',
    'checkout.availabilityExplanation': 'We checked real-time store availability and found item(s) that cannot be fulfilled. If you selected an alternative product, you can swap it now with one click:',
    'checkout.temporarilySnoozed': 'Temporarily snoozed by store',
    'checkout.outOfStock': 'Out of stock at this store',
    'checkout.remove': 'Remove',
    'checkout.chosenReplacement': 'Chosen replacement',
    'checkout.substituteAlsoUnavailable': 'Your chosen substitute is also currently unavailable.',
    'checkout.noSubstituteConfigured': 'No substitute preference was configured.',
    'checkout.chooseSubstitute': 'Choose Substitute',
    'checkout.deliveryAddress': 'Delivery Address',
    'checkout.noDeliveryAddress': 'No delivery address provided',
    'checkout.fulfilmentMethod': 'Fulfilment Method',
    'checkout.inStoreCollection': 'In-Store Collection',
    'checkout.selectedStore': 'Selected Store',
    'checkout.fulfillingStore': 'Fulfilling Store',
    'checkout.immediatePriority': 'Immediate Priority',
    'checkout.preOrderSlot': 'Pre-Order Slot',
    'checkout.asapCollection': 'ASAP Collection',
    'checkout.asapDelivery': 'ASAP Delivery',
    'checkout.eta': 'ETA',
    'checkout.scheduledSlot': 'Scheduled Slot',
    'checkout.selectDateTime': 'Select date/time',
    'checkout.selectReservationWindow': 'Select Reservation Window',
    'checkout.subPriceGuarantee': 'Best-Match Price Guarantee: you always pay the lower price!',
    'checkout.subInstructions': 'Choose what our in-store shopper should do if any item is out of stock:',
    'checkout.contactDetails': 'Contact details',
    'checkout.contactDetailsHelp': 'Used by the store for this order. Enter a name plus an email address or phone number.',
    'checkout.name': 'Name',
    'checkout.email': 'Email',
    'checkout.phone': 'Phone',
    'checkout.namePlaceholder': 'Name for collection',
    'checkout.itemsSubtotal': 'Items Subtotal',
    'checkout.refundableDeposit': 'Refundable DRS Bottle Deposit',
    'checkout.payableTotal': 'Authoritative Payable Total',
    'checkout.collectionOrder': 'Collection Order',
    'checkout.collectionOrderNotice': 'This Collection checkout is submitted directly to the store. No card pre-authorisation, payment capture, or courier dispatch is created on this order path.',
    'checkout.paymentModel': 'Retail Grocery Payment Model',
    'checkout.hostedPayAlternative': 'Or use Deliverect Pay Hosted Session',
    'checkout.hostedPayTitle': 'Deliverect Pay Hosted Session',
    'checkout.hostedPayDescription': 'A secure hosted payment session has been created by our Backend-for-Frontend.',
    'checkout.session': 'Session',
    'checkout.brand': 'Brand',
    'checkout.amountDue': 'Amount Due',
    'checkout.supportedWallets': 'Supported Wallets',
    'checkout.completeHostedPayment': 'Complete Payment on Deliverect Pay',
    'checkout.cancelReturnBasket': 'Cancel & Return to Basket',
    'checkout.processingOrder': 'Processing Order',
    'checkout.orderConfirmed': 'Order confirmed',
    'checkout.orderConfirmedSync': 'The store has received your order. We’re syncing the live order details now.',
    'checkout.loadingTracking': 'Loading order tracking…',
    'checkout.closeConfirmed': 'Close — order will remain confirmed',
    'checkout.orderUnsuccessful': 'Order Unsuccessful',
    'checkout.paymentUnsuccessful': 'Payment Unsuccessful',
    'checkout.noPaymentTaken': 'No payment was taken. Your basket items have been preserved.',
    'checkout.noChargesCaptured': 'No charges were captured on your account. Your basket items have been preserved.',
    'checkout.tryOrderAgain': 'Try Placing Order Again',
    'checkout.tryPaymentAgain': 'Try Payment Again',
    'checkout.closeKeepBasket': 'Close & Keep Basket',
    'checkout.paymentNoticeStart': 'You are not charged immediately. We pre-authorize up to',
    'checkout.paymentNoticeEstimated': 'estimated total',
    'checkout.paymentNoticeBuffer': 'pre-chosen alternative buffer',
    'checkout.paymentNoticeEnd': 'The final amount will only be captured when store picking completes.',
    'checkout.collectionNoPayment': 'No payment authorisation or courier dispatch for Collection',
    'checkout.resolveOutOfStock': 'Resolve Out of Stock Items Above',
    'checkout.collectionIssueRetry': 'Collection Order Issue - Retry Above',
    'checkout.dispatchUnavailableRetry': 'Courier Dispatch Unavailable - Retry Above',
    'checkout.placeCollectionOrder': 'Place Collection Order',
    'checkout.authorizeUpTo': 'Authorize & Place Order (up to',
    'checkout.recoveringOrder': 'Recovering Order...',
    'checkout.retryCollectionOrder': 'Retry Collection Order',
    'checkout.checkingAvailability': 'Checking Availability...',
    'checkout.retryAvailabilityCheck': 'Retry Availability Check',
    'checkout.switchToPickup': 'Switch to Pickup',
    'checkout.availableStoresCouriers': 'Available stores with couriers',
    'checkout.initializingPayment': 'Initializing payment session...',
    'checkout.preparingPayment': 'Preparing payment...',
    'checkout.paymentGateway': 'Communicating with payment gateway...',
    'checkout.paymentAuthorised': 'Payment authorised by bank. Securing dispatch slot...',
    'checkout.placingOrder': 'Placing order with store & dispatching courier...',
    'checkout.stepPlacingCollection': 'Placing collection order with store',
    'checkout.stepPreparingPayment': 'Preparing payment',
    'checkout.stepPaymentAuthorised': 'Payment authorised',
    'checkout.stepPlacingOrder': 'Placing order with store',
    'checkout.stepOrderConfirmed': 'Order confirmed',
    'checkout.chooseOptions': 'Choose options',
    'checkout.preChosen': 'Pre-chosen',
    'checkout.removeRefundItem': 'Remove & refund item',
    'checkout.cancelEntireOrder': 'Cancel entire order',
    'checkout.bestMatchGuarantee': 'Best match (Same or lower price guarantee)',
    'checkout.dispatchQuoteGuaranteed': 'Dispatch quote guaranteed',
    'checkout.dispatchQuoteExpired': 'Dispatch quote expired',
    'checkout.dispatchConfirmation': 'Authoritative Deliverect Dispatch slot confirmation',
    'checkout.checking': 'Checking...',
    'checkout.recheck': 'Recheck',
    'checkout.collectionIssue': 'Collection Order Issue',
    'checkout.dispatchUnavailable': 'Dispatch Unavailable',
    'checkout.partnerStore': 'Partner Store',
    'checkout.switchAndOrder': 'Switch & Order',
    'checkout.tipCourier': 'Tip your courier (100% goes to driver)',
    'checkout.none': 'None',
    'checkout.promoGiftCode': 'Promo or Gift Code',
    'checkout.applying': 'Applying...',
    'checkout.apply': 'Apply',
    'checkout.placingCollectionOrder': 'Placing Collection Order...',
    'checkout.authorizingSubmitting': 'Authorizing & Submitting...',

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
    'checkout.itemAvailabilityNotice': 'Disponibilidad y sustituciones',
    'checkout.swapAllAvailable': 'Cambiar todos por sustitutos disponibles',
    'checkout.availabilityExplanation': 'Hemos comprobado la disponibilidad de la tienda en tiempo real y algunos artículos no pueden prepararse. Si elegiste una alternativa, puedes cambiarla ahora:',
    'checkout.temporarilySnoozed': 'Pausado temporalmente por la tienda',
    'checkout.outOfStock': 'Agotado en esta tienda',
    'checkout.remove': 'Eliminar',
    'checkout.chosenReplacement': 'Sustituto elegido',
    'checkout.substituteAlsoUnavailable': 'El sustituto elegido tampoco está disponible.',
    'checkout.noSubstituteConfigured': 'No se configuró ninguna preferencia de sustitución.',
    'checkout.chooseSubstitute': 'Elegir sustituto',
    'checkout.deliveryAddress': 'Dirección de entrega',
    'checkout.noDeliveryAddress': 'No se ha indicado una dirección de entrega',
    'checkout.fulfilmentMethod': 'Método de entrega',
    'checkout.inStoreCollection': 'Recogida en tienda',
    'checkout.selectedStore': 'Tienda seleccionada',
    'checkout.fulfillingStore': 'Tienda que prepara el pedido',
    'checkout.immediatePriority': 'Prioridad inmediata',
    'checkout.preOrderSlot': 'Franja programada',
    'checkout.asapCollection': 'Recogida lo antes posible',
    'checkout.asapDelivery': 'Entrega lo antes posible',
    'checkout.eta': 'Hora estimada',
    'checkout.scheduledSlot': 'Franja programada',
    'checkout.selectDateTime': 'Selecciona fecha/hora',
    'checkout.selectReservationWindow': 'Selecciona una franja',
    'checkout.subPriceGuarantee': 'Garantía de mejor precio: siempre pagas el precio más bajo.',
    'checkout.subInstructions': 'Elige qué debe hacer la tienda si un artículo está agotado:',
    'checkout.contactDetails': 'Datos de contacto',
    'checkout.contactDetailsHelp': 'La tienda usará estos datos para el pedido. Introduce un nombre y un correo electrónico o teléfono.',
    'checkout.name': 'Nombre',
    'checkout.email': 'Correo electrónico',
    'checkout.phone': 'Teléfono',
    'checkout.namePlaceholder': 'Nombre para la recogida',
    'checkout.itemsSubtotal': 'Subtotal de artículos',
    'checkout.refundableDeposit': 'Depósito DRS reembolsable',
    'checkout.payableTotal': 'Total a pagar',
    'checkout.collectionOrder': 'Pedido para recogida',
    'checkout.collectionOrderNotice': 'Este pedido de recogida se envía directamente a la tienda. No se crea preautorización de tarjeta, cobro ni envío con repartidor.',
    'checkout.paymentModel': 'Modelo de pago para alimentación',
    'checkout.hostedPayAlternative': 'O usar la sesión alojada de Deliverect Pay',
    'checkout.hostedPayTitle': 'Sesión alojada de Deliverect Pay',
    'checkout.hostedPayDescription': 'Nuestro backend ha creado una sesión de pago alojada y segura.',
    'checkout.session': 'Sesión',
    'checkout.brand': 'Marca',
    'checkout.amountDue': 'Importe a pagar',
    'checkout.supportedWallets': 'Métodos compatibles',
    'checkout.completeHostedPayment': 'Completar pago en Deliverect Pay',
    'checkout.cancelReturnBasket': 'Cancelar y volver a la cesta',
    'checkout.processingOrder': 'Procesando pedido',
    'checkout.orderConfirmed': 'Pedido confirmado',
    'checkout.orderConfirmedSync': 'La tienda ha recibido tu pedido. Estamos sincronizando los detalles en tiempo real.',
    'checkout.loadingTracking': 'Cargando seguimiento del pedido…',
    'checkout.closeConfirmed': 'Cerrar — el pedido seguirá confirmado',
    'checkout.orderUnsuccessful': 'No se pudo realizar el pedido',
    'checkout.paymentUnsuccessful': 'No se pudo realizar el pago',
    'checkout.noPaymentTaken': 'No se realizó ningún cobro. Los artículos siguen en tu cesta.',
    'checkout.noChargesCaptured': 'No se realizó ningún cargo. Los artículos siguen en tu cesta.',
    'checkout.tryOrderAgain': 'Intentar realizar el pedido de nuevo',
    'checkout.tryPaymentAgain': 'Intentar el pago de nuevo',
    'checkout.closeKeepBasket': 'Cerrar y conservar la cesta',
    'checkout.paymentNoticeStart': 'No se te cobra inmediatamente. Preautorizamos hasta',
    'checkout.paymentNoticeEstimated': 'total estimado',
    'checkout.paymentNoticeBuffer': 'margen para la alternativa elegida',
    'checkout.paymentNoticeEnd': 'El importe final solo se cobrará cuando la tienda termine de preparar el pedido.',
    'checkout.collectionNoPayment': 'Sin autorización de pago ni envío con repartidor para la recogida',
    'checkout.resolveOutOfStock': 'Resuelve los artículos agotados de arriba',
    'checkout.collectionIssueRetry': 'Problema con el pedido de recogida: vuelve a intentarlo arriba',
    'checkout.dispatchUnavailableRetry': 'Reparto no disponible: vuelve a intentarlo arriba',
    'checkout.placeCollectionOrder': 'Realizar pedido para recogida',
    'checkout.authorizeUpTo': 'Autorizar y realizar pedido (hasta',
    'checkout.recoveringOrder': 'Recuperando pedido...',
    'checkout.retryCollectionOrder': 'Reintentar pedido de recogida',
    'checkout.checkingAvailability': 'Comprobando disponibilidad...',
    'checkout.retryAvailabilityCheck': 'Volver a comprobar disponibilidad',
    'checkout.switchToPickup': 'Cambiar a recogida',
    'checkout.availableStoresCouriers': 'Tiendas disponibles con repartidores',
    'checkout.initializingPayment': 'Iniciando sesión de pago...',
    'checkout.preparingPayment': 'Preparando pago...',
    'checkout.paymentGateway': 'Conectando con la pasarela de pago...',
    'checkout.paymentAuthorised': 'Pago autorizado por el banco. Reservando reparto...',
    'checkout.placingOrder': 'Enviando pedido a la tienda y asignando repartidor...',
    'checkout.stepPlacingCollection': 'Enviando pedido de recogida a la tienda',
    'checkout.stepPreparingPayment': 'Preparando pago',
    'checkout.stepPaymentAuthorised': 'Pago autorizado',
    'checkout.stepPlacingOrder': 'Enviando pedido a la tienda',
    'checkout.stepOrderConfirmed': 'Pedido confirmado',
    'checkout.chooseOptions': 'Elegir opciones',
    'checkout.preChosen': 'Elegido previamente',
    'checkout.removeRefundItem': 'Eliminar y reembolsar artículo',
    'checkout.cancelEntireOrder': 'Cancelar todo el pedido',
    'checkout.bestMatchGuarantee': 'Mejor opción (garantía de mismo o menor precio)',
    'checkout.dispatchQuoteGuaranteed': 'Cotización de reparto garantizada',
    'checkout.dispatchQuoteExpired': 'La cotización de reparto ha caducado',
    'checkout.dispatchConfirmation': 'Confirmación autorizada de franja de Deliverect Dispatch',
    'checkout.checking': 'Comprobando...',
    'checkout.recheck': 'Volver a comprobar',
    'checkout.collectionIssue': 'Problema con el pedido de recogida',
    'checkout.dispatchUnavailable': 'Reparto no disponible',
    'checkout.partnerStore': 'Tienda asociada',
    'checkout.switchAndOrder': 'Cambiar y pedir',
    'checkout.tipCourier': 'Propina al repartidor (100% para el conductor)',
    'checkout.none': 'Ninguna',
    'checkout.promoGiftCode': 'Código promocional o regalo',
    'checkout.applying': 'Aplicando...',
    'checkout.apply': 'Aplicar',
    'checkout.placingCollectionOrder': 'Enviando pedido de recogida...',
    'checkout.authorizingSubmitting': 'Autorizando y enviando...',

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
    'checkout.itemAvailabilityNotice': 'Disponibilité et substitutions',
    'checkout.swapAllAvailable': 'Remplacer par tous les substituts disponibles',
    'checkout.availabilityExplanation': 'Nous avons vérifié le stock du magasin en temps réel et certains articles ne peuvent pas être préparés. Si vous avez choisi une alternative, vous pouvez la remplacer maintenant :',
    'checkout.temporarilySnoozed': 'Temporairement suspendu par le magasin',
    'checkout.outOfStock': 'Rupture de stock dans ce magasin',
    'checkout.remove': 'Supprimer',
    'checkout.chosenReplacement': 'Substitut choisi',
    'checkout.substituteAlsoUnavailable': 'Le substitut choisi est également indisponible.',
    'checkout.noSubstituteConfigured': 'Aucune préférence de substitution n’a été configurée.',
    'checkout.chooseSubstitute': 'Choisir un substitut',
    'checkout.deliveryAddress': 'Adresse de livraison',
    'checkout.noDeliveryAddress': 'Aucune adresse de livraison indiquée',
    'checkout.fulfilmentMethod': 'Mode de retrait/livraison',
    'checkout.inStoreCollection': 'Retrait en magasin',
    'checkout.selectedStore': 'Magasin sélectionné',
    'checkout.fulfillingStore': 'Magasin préparateur',
    'checkout.immediatePriority': 'Priorité immédiate',
    'checkout.preOrderSlot': 'Créneau de précommande',
    'checkout.asapCollection': 'Retrait au plus vite',
    'checkout.asapDelivery': 'Livraison au plus vite',
    'checkout.eta': 'Heure estimée',
    'checkout.scheduledSlot': 'Créneau programmé',
    'checkout.selectDateTime': 'Sélectionner date/heure',
    'checkout.selectReservationWindow': 'Sélectionner un créneau',
    'checkout.subPriceGuarantee': 'Garantie du meilleur prix : vous payez toujours le prix le plus bas.',
    'checkout.subInstructions': 'Choisissez ce que le magasin doit faire si un article est indisponible :',
    'checkout.contactDetails': 'Coordonnées',
    'checkout.contactDetailsHelp': 'Le magasin utilise ces informations pour cette commande. Saisissez un nom et un e-mail ou un numéro de téléphone.',
    'checkout.name': 'Nom',
    'checkout.email': 'E-mail',
    'checkout.phone': 'Téléphone',
    'checkout.namePlaceholder': 'Nom pour le retrait',
    'checkout.itemsSubtotal': 'Sous-total des articles',
    'checkout.refundableDeposit': 'Consigne DRS remboursable',
    'checkout.payableTotal': 'Total à payer',
    'checkout.collectionOrder': 'Commande à retirer',
    'checkout.collectionOrderNotice': 'Cette commande de retrait est envoyée directement au magasin. Aucune préautorisation de carte, capture de paiement ou livraison par coursier n’est créée.',
    'checkout.paymentModel': 'Modèle de paiement courses',
    'checkout.hostedPayAlternative': 'Ou utiliser la session hébergée Deliverect Pay',
    'checkout.hostedPayTitle': 'Session hébergée Deliverect Pay',
    'checkout.hostedPayDescription': 'Une session de paiement hébergée et sécurisée a été créée par notre backend.',
    'checkout.session': 'Session',
    'checkout.brand': 'Marque',
    'checkout.amountDue': 'Montant dû',
    'checkout.supportedWallets': 'Moyens compatibles',
    'checkout.completeHostedPayment': 'Finaliser le paiement avec Deliverect Pay',
    'checkout.cancelReturnBasket': 'Annuler et revenir au panier',
    'checkout.processingOrder': 'Traitement de la commande',
    'checkout.orderConfirmed': 'Commande confirmée',
    'checkout.orderConfirmedSync': 'Le magasin a reçu votre commande. Nous synchronisons les détails en temps réel.',
    'checkout.loadingTracking': 'Chargement du suivi…',
    'checkout.closeConfirmed': 'Fermer — la commande reste confirmée',
    'checkout.orderUnsuccessful': 'Commande non aboutie',
    'checkout.paymentUnsuccessful': 'Paiement non abouti',
    'checkout.noPaymentTaken': 'Aucun paiement n’a été effectué. Les articles restent dans votre panier.',
    'checkout.noChargesCaptured': 'Aucun montant n’a été débité. Les articles restent dans votre panier.',
    'checkout.tryOrderAgain': 'Réessayer la commande',
    'checkout.tryPaymentAgain': 'Réessayer le paiement',
    'checkout.closeKeepBasket': 'Fermer et conserver le panier',
    'checkout.paymentNoticeStart': 'Vous n’êtes pas débité immédiatement. Nous préautorisons jusqu’à',
    'checkout.paymentNoticeEstimated': 'total estimé',
    'checkout.paymentNoticeBuffer': 'marge pour l’alternative choisie',
    'checkout.paymentNoticeEnd': 'Le montant final ne sera débité qu’une fois la préparation terminée en magasin.',
    'checkout.collectionNoPayment': 'Aucune autorisation de paiement ni livraison par coursier pour le retrait',
    'checkout.resolveOutOfStock': 'Résolvez les articles indisponibles ci-dessus',
    'checkout.collectionIssueRetry': 'Problème avec la commande à retirer — réessayez ci-dessus',
    'checkout.dispatchUnavailableRetry': 'Livraison indisponible — réessayez ci-dessus',
    'checkout.placeCollectionOrder': 'Passer la commande à retirer',
    'checkout.authorizeUpTo': 'Autoriser et commander (jusqu’à',
    'checkout.recoveringOrder': 'Récupération de la commande...',
    'checkout.retryCollectionOrder': 'Réessayer la commande à retirer',
    'checkout.checkingAvailability': 'Vérification de la disponibilité...',
    'checkout.retryAvailabilityCheck': 'Revérifier la disponibilité',
    'checkout.switchToPickup': 'Passer au retrait',
    'checkout.availableStoresCouriers': 'Magasins disponibles avec coursiers',
    'checkout.initializingPayment': 'Initialisation de la session de paiement...',
    'checkout.preparingPayment': 'Préparation du paiement...',
    'checkout.paymentGateway': 'Connexion à la passerelle de paiement...',
    'checkout.paymentAuthorised': 'Paiement autorisé par la banque. Réservation de la livraison...',
    'checkout.placingOrder': 'Envoi de la commande au magasin et affectation du coursier...',
    'checkout.stepPlacingCollection': 'Envoi de la commande de retrait au magasin',
    'checkout.stepPreparingPayment': 'Préparation du paiement',
    'checkout.stepPaymentAuthorised': 'Paiement autorisé',
    'checkout.stepPlacingOrder': 'Envoi de la commande au magasin',
    'checkout.stepOrderConfirmed': 'Commande confirmée',
    'checkout.chooseOptions': 'Choisir les options',
    'checkout.preChosen': 'Choisi à l’avance',
    'checkout.removeRefundItem': 'Supprimer et rembourser l’article',
    'checkout.cancelEntireOrder': 'Annuler toute la commande',
    'checkout.bestMatchGuarantee': 'Meilleure correspondance (prix identique ou inférieur garanti)',
    'checkout.dispatchQuoteGuaranteed': 'Devis de livraison garanti',
    'checkout.dispatchQuoteExpired': 'Le devis de livraison a expiré',
    'checkout.dispatchConfirmation': 'Confirmation officielle du créneau Deliverect Dispatch',
    'checkout.checking': 'Vérification...',
    'checkout.recheck': 'Revérifier',
    'checkout.collectionIssue': 'Problème avec la commande à retirer',
    'checkout.dispatchUnavailable': 'Livraison indisponible',
    'checkout.partnerStore': 'Magasin partenaire',
    'checkout.switchAndOrder': 'Changer et commander',
    'checkout.tipCourier': 'Pourboire au coursier (100 % pour le livreur)',
    'checkout.none': 'Aucun',
    'checkout.promoGiftCode': 'Code promo ou cadeau',
    'checkout.applying': 'Application...',
    'checkout.apply': 'Appliquer',
    'checkout.placingCollectionOrder': 'Envoi de la commande à retirer...',
    'checkout.authorizingSubmitting': 'Autorisation et envoi...',

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

    'checkout.orderTracking': 'Bestellung verfolgen',
    'checkout.hostedCheckout': 'Deliverect Pay Checkout',
    'checkout.confirmingOrder': 'Bestellung wird bestätigt',
    'checkout.secureCheckout': 'Sicherer Checkout',
    'checkout.itemAvailabilityNotice': 'Verfügbarkeit & Ersatzartikel',
    'checkout.swapAllAvailable': 'Alle durch verfügbare Ersatzartikel ersetzen',
    'checkout.availabilityExplanation': 'Wir haben den Filialbestand in Echtzeit geprüft. Einige Artikel können nicht erfüllt werden. Wenn du eine Alternative gewählt hast, kannst du sie jetzt ersetzen:',
    'checkout.temporarilySnoozed': 'Von der Filiale vorübergehend pausiert',
    'checkout.outOfStock': 'In dieser Filiale ausverkauft',
    'checkout.remove': 'Entfernen',
    'checkout.chosenReplacement': 'Gewählter Ersatz',
    'checkout.substituteAlsoUnavailable': 'Der gewählte Ersatzartikel ist ebenfalls nicht verfügbar.',
    'checkout.noSubstituteConfigured': 'Keine Ersatzartikel-Präferenz festgelegt.',
    'checkout.chooseSubstitute': 'Ersatz wählen',
    'checkout.deliveryAddress': 'Lieferadresse',
    'checkout.noDeliveryAddress': 'Keine Lieferadresse angegeben',
    'checkout.fulfilmentMethod': 'Erfüllungsart',
    'checkout.inStoreCollection': 'Abholung in der Filiale',
    'checkout.selectedStore': 'Ausgewählte Filiale',
    'checkout.fulfillingStore': 'Ausführende Filiale',
    'checkout.immediatePriority': 'Sofortige Priorität',
    'checkout.preOrderSlot': 'Vorbestell-Zeitfenster',
    'checkout.asapCollection': 'Schnellstmögliche Abholung',
    'checkout.asapDelivery': 'Schnellstmögliche Lieferung',
    'checkout.eta': 'Voraussichtliche Zeit',
    'checkout.scheduledSlot': 'Geplantes Zeitfenster',
    'checkout.selectDateTime': 'Datum/Uhrzeit wählen',
    'checkout.selectReservationWindow': 'Zeitfenster auswählen',
    'checkout.subPriceGuarantee': 'Bestpreisgarantie: Du zahlst immer den niedrigeren Preis.',
    'checkout.subInstructions': 'Wähle, was die Filiale tun soll, wenn ein Artikel nicht verfügbar ist:',
    'checkout.contactDetails': 'Kontaktdaten',
    'checkout.contactDetailsHelp': 'Die Filiale nutzt diese Angaben für die Bestellung. Gib einen Namen und eine E-Mail-Adresse oder Telefonnummer an.',
    'checkout.name': 'Name',
    'checkout.email': 'E-Mail',
    'checkout.phone': 'Telefon',
    'checkout.namePlaceholder': 'Name für die Abholung',
    'checkout.itemsSubtotal': 'Artikel-Zwischensumme',
    'checkout.refundableDeposit': 'Erstattungsfähiges DRS-Pfand',
    'checkout.payableTotal': 'Zu zahlender Gesamtbetrag',
    'checkout.collectionOrder': 'Abholbestellung',
    'checkout.collectionOrderNotice': 'Diese Abholbestellung wird direkt an die Filiale gesendet. Es werden keine Kartenvorautorisierung, Zahlungserfassung oder Kurierzustellung erstellt.',
    'checkout.paymentModel': 'Zahlungsmodell für Lebensmittel',
    'checkout.hostedPayAlternative': 'Oder Deliverect Pay verwenden',
    'checkout.hostedPayTitle': 'Deliverect Pay Sitzung',
    'checkout.hostedPayDescription': 'Unser Backend hat eine sichere gehostete Zahlungssitzung erstellt.',
    'checkout.session': 'Sitzung',
    'checkout.brand': 'Marke',
    'checkout.amountDue': 'Fälliger Betrag',
    'checkout.supportedWallets': 'Unterstützte Zahlungsarten',
    'checkout.completeHostedPayment': 'Zahlung mit Deliverect Pay abschließen',
    'checkout.cancelReturnBasket': 'Abbrechen & zum Warenkorb',
    'checkout.processingOrder': 'Bestellung wird verarbeitet',
    'checkout.orderConfirmed': 'Bestellung bestätigt',
    'checkout.orderConfirmedSync': 'Die Filiale hat deine Bestellung erhalten. Wir synchronisieren jetzt die Live-Details.',
    'checkout.loadingTracking': 'Bestellverfolgung wird geladen…',
    'checkout.closeConfirmed': 'Schließen — Bestellung bleibt bestätigt',
    'checkout.orderUnsuccessful': 'Bestellung nicht erfolgreich',
    'checkout.paymentUnsuccessful': 'Zahlung nicht erfolgreich',
    'checkout.noPaymentTaken': 'Es wurde keine Zahlung vorgenommen. Deine Artikel bleiben im Warenkorb.',
    'checkout.noChargesCaptured': 'Es wurde nichts belastet. Deine Artikel bleiben im Warenkorb.',
    'checkout.tryOrderAgain': 'Bestellung erneut versuchen',
    'checkout.tryPaymentAgain': 'Zahlung erneut versuchen',
    'checkout.closeKeepBasket': 'Schließen & Warenkorb behalten',
    'checkout.paymentNoticeStart': 'Du wirst nicht sofort belastet. Wir autorisieren vorab bis zu',
    'checkout.paymentNoticeEstimated': 'geschätzter Gesamtbetrag',
    'checkout.paymentNoticeBuffer': 'Puffer für die gewählte Alternative',
    'checkout.paymentNoticeEnd': 'Der endgültige Betrag wird erst nach Abschluss der Kommissionierung abgebucht.',
    'checkout.collectionNoPayment': 'Keine Zahlungsautorisierung oder Kurierzustellung bei Abholung',
    'checkout.resolveOutOfStock': 'Nicht verfügbare Artikel oben klären',
    'checkout.collectionIssueRetry': 'Problem mit Abholbestellung — oben erneut versuchen',
    'checkout.dispatchUnavailableRetry': 'Kurierzustellung nicht verfügbar — oben erneut versuchen',
    'checkout.placeCollectionOrder': 'Abholbestellung aufgeben',
    'checkout.authorizeUpTo': 'Autorisieren & bestellen (bis zu',
    'checkout.recoveringOrder': 'Bestellung wird wiederhergestellt...',
    'checkout.retryCollectionOrder': 'Abholbestellung erneut versuchen',
    'checkout.checkingAvailability': 'Verfügbarkeit wird geprüft...',
    'checkout.retryAvailabilityCheck': 'Verfügbarkeit erneut prüfen',
    'checkout.switchToPickup': 'Zur Abholung wechseln',
    'checkout.availableStoresCouriers': 'Verfügbare Filialen mit Kurieren',
    'checkout.initializingPayment': 'Zahlungssitzung wird initialisiert...',
    'checkout.preparingPayment': 'Zahlung wird vorbereitet...',
    'checkout.paymentGateway': 'Verbindung zum Zahlungsanbieter...',
    'checkout.paymentAuthorised': 'Zahlung von der Bank autorisiert. Zustellung wird reserviert...',
    'checkout.placingOrder': 'Bestellung wird an die Filiale gesendet und Kurier disponiert...',
    'checkout.stepPlacingCollection': 'Abholbestellung wird an die Filiale gesendet',
    'checkout.stepPreparingPayment': 'Zahlung wird vorbereitet',
    'checkout.stepPaymentAuthorised': 'Zahlung autorisiert',
    'checkout.stepPlacingOrder': 'Bestellung wird an die Filiale gesendet',
    'checkout.stepOrderConfirmed': 'Bestellung bestätigt',
    'checkout.chooseOptions': 'Optionen wählen',
    'checkout.preChosen': 'Vorab gewählt',
    'checkout.removeRefundItem': 'Artikel entfernen & erstatten',
    'checkout.cancelEntireOrder': 'Gesamte Bestellung stornieren',
    'checkout.bestMatchGuarantee': 'Beste Übereinstimmung (gleicher oder niedrigerer Preis garantiert)',
    'checkout.dispatchQuoteGuaranteed': 'Kurierangebot garantiert',
    'checkout.dispatchQuoteExpired': 'Kurierangebot abgelaufen',
    'checkout.dispatchConfirmation': 'Verbindliche Bestätigung des Deliverect-Dispatch-Zeitfensters',
    'checkout.checking': 'Prüfung...',
    'checkout.recheck': 'Erneut prüfen',
    'checkout.collectionIssue': 'Problem mit Abholbestellung',
    'checkout.dispatchUnavailable': 'Kurierzustellung nicht verfügbar',
    'checkout.partnerStore': 'Partnerfiliale',
    'checkout.switchAndOrder': 'Wechseln & bestellen',
    'checkout.tipCourier': 'Trinkgeld für den Kurier (100 % gehen an den Fahrer)',
    'checkout.none': 'Keins',
    'checkout.promoGiftCode': 'Promo- oder Geschenrcode',
    'checkout.applying': 'Wird angewendet...',
    'checkout.apply': 'Anwenden',
    'checkout.placingCollectionOrder': 'Abholbestellung wird aufgegeben...',
    'checkout.authorizingSubmitting': 'Autorisierung & Übermittlung...',

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
  },
};
