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
