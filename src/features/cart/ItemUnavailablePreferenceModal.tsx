import React, { useState, useMemo } from 'react';
import { BasketItem, Product, SubstitutionPreferenceType, Money, moneyToMajor } from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { useI18n } from '../../i18n/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  Trash2,
  Minus,
  Plus,
  ArrowRightLeft,
  Sparkles,
  Search,
  Check,
  AlertTriangle,
  ArrowRight,
  Package,
} from 'lucide-react';

export interface ItemUnavailablePreferenceModalProps {
  isOpen: boolean;
  item: BasketItem | null;
  storeId?: string;
  candidateProducts?: Product[];
  onClose: () => void;
  onUpdate: (payload: {
    plu: string;
    quantity: number;
    preference: SubstitutionPreferenceType;
    preferredSubstitutePlu?: string;
    preferredSubstituteName?: string;
    preferredSubstitutePrice?: number;
    storeId?: string;
  }) => void;
  onRemoveItem: (plu: string, storeId?: string) => void;
}

export const ItemUnavailablePreferenceModal: React.FC<ItemUnavailablePreferenceModalProps> = ({
  isOpen,
  item,
  storeId,
  candidateProducts = [],
  onClose,
  onUpdate,
  onRemoveItem,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();
  const { t } = useI18n();

  // Local form state
  const [quantity, setQuantity] = useState<number>(1);
  const [preference, setPreference] = useState<SubstitutionPreferenceType>('BEST_MATCH');
  const [preferredPlu, setPreferredPlu] = useState<string>('');
  const [isChoosingAlternative, setIsChoosingAlternative] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Sync state when item opens
  React.useEffect(() => {
    if (item && isOpen) {
      setQuantity(item.quantity || 1);
      setPreference(item.substitutionPreference || 'BEST_MATCH');
      setPreferredPlu(item.preferredSubstitutePlu || '');
      setIsChoosingAlternative(false);
      setSearchFilter('');
    }
  }, [item, isOpen]);

  const originalPriceMajor = useMemo(() => {
    if (!item) return 0;
    return moneyToMajor(item.unitPrice || item.price);
  }, [item]);

  // Selected alternative product object
  const selectedAlternativeProduct = useMemo(() => {
    if (!preferredPlu) return null;
    return candidateProducts.find((p) => p.plu === preferredPlu) || null;
  }, [preferredPlu, candidateProducts]);

  const selectedAlternativePriceMajor = useMemo(() => {
    if (!selectedAlternativeProduct) {
      if (item?.preferredSubstitutePrice != null) {
        return moneyToMajor(item.preferredSubstitutePrice);
      }
      return 0;
    }
    return moneyToMajor(selectedAlternativeProduct.price);
  }, [selectedAlternativeProduct, item]);

  const priceDifferenceMajor = useMemo(() => {
    if (!selectedAlternativePriceMajor || !originalPriceMajor) return 0;
    return selectedAlternativePriceMajor - originalPriceMajor;
  }, [selectedAlternativePriceMajor, originalPriceMajor]);

  // Filtered candidate alternative list
  const availableAlternatives = useMemo(() => {
    if (!item) return [];
    const pool = candidateProducts.filter((p) => p.plu !== item.plu && p.active !== false);

    if (!searchFilter.trim()) {
      return pool.slice(0, 15);
    }
    const q = searchFilter.toLowerCase();
    return pool.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.productTags && p.productTags.some((t) => String(t).toLowerCase().includes(q)))
    );
  }, [item, candidateProducts, searchFilter]);

  if (!isOpen || !item) return null;

  const handleIncrement = () => {
    setQuantity((q) => Math.min(q + 1, 99));
  };

  const handleDecrement = () => {
    setQuantity((q) => Math.max(q - 1, 1));
  };

  const handleDeleteItem = () => {
    onRemoveItem(item.plu, storeId);
    onClose();
  };

  const handleSelectAlternative = (prod: Product) => {
    setPreferredPlu(prod.plu);
    setIsChoosingAlternative(false);
  };

  const handleSave = () => {
    const altName = selectedAlternativeProduct?.name || (item.preferredSubstitutePlu === preferredPlu ? item.preferredSubstituteName : undefined);
    const altPrice = selectedAlternativeProduct
      ? moneyToMajor(selectedAlternativeProduct.price)
      : item.preferredSubstitutePlu === preferredPlu && item.preferredSubstitutePrice != null
      ? moneyToMajor(item.preferredSubstitutePrice)
      : undefined;

    onUpdate({
      plu: item.plu,
      quantity,
      preference,
      preferredSubstitutePlu: preference === 'CUSTOMER_SELECTED' ? preferredPlu : undefined,
      preferredSubstituteName: preference === 'CUSTOMER_SELECTED' ? altName : undefined,
      preferredSubstitutePrice: preference === 'CUSTOMER_SELECTED' ? altPrice : undefined,
      storeId,
    });
    onClose();
  };

  return (
    <div
      id="item-unavailable-modal-backdrop"
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="item-unavailable-modal-card"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP BAR */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDeleteItem}
            id="modal-delete-item-btn"
            className="w-9 h-9 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center justify-center transition-colors"
            title="Remove item from basket"
            aria-label="Remove item from basket"
          >
            <Trash2 className="w-5 h-5 stroke-[2.2]" />
          </button>

          <h3 className="text-sm font-bold text-gray-900 text-center px-3 truncate max-w-[260px]">
            {item.name || t('basket.item')}
          </h3>

          <button
            type="button"
            onClick={onClose}
            id="modal-close-btn"
            className="w-9 h-9 rounded-full text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 flex items-center justify-center transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* STEPPER: QUANTITY ADJUSTMENT */}
          <div className="flex items-center justify-center gap-7 py-2">
            <button
              type="button"
              id="modal-qty-decrement"
              onClick={handleDecrement}
              disabled={quantity <= 1}
              className="w-10 h-10 rounded-full border-2 border-emerald-600 text-emerald-600 flex items-center justify-center hover:bg-emerald-50 active:scale-95 transition-all disabled:opacity-30 disabled:border-gray-300 disabled:text-gray-300"
              aria-label="Decrease quantity"
            >
              <Minus className="w-5 h-5 stroke-[2.5]" />
            </button>

            <span className="text-2xl font-black text-gray-900 min-w-[32px] text-center">
              {quantity}
            </span>

            <button
              type="button"
              id="modal-qty-increment"
              onClick={handleIncrement}
              className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all shadow-xs"
              aria-label="Increase quantity"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* SECTION HEADER */}
          <div>
            <h4 className="text-base font-extrabold text-gray-900 tracking-tight">
              {t('basket.ifItemUnavailable')}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('basket.unavailablePreferenceHelp')}
            </p>
          </div>

          {/* RADIO OPTIONS LIST */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 bg-white shadow-2xs">
            {/* OPTION 1: BEST MATCH */}
            <label
              htmlFor="pref-best-match"
              className={`flex items-start gap-3.5 p-4 cursor-pointer transition-colors ${
                preference === 'BEST_MATCH' ? 'bg-emerald-50/40' : 'hover:bg-gray-50/70'
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="radio"
                  id="pref-best-match"
                  name="substitution-preference"
                  value="BEST_MATCH"
                  checked={preference === 'BEST_MATCH'}
                  on{t('basket.change')}={() => setPreference('BEST_MATCH')}
                  className="w-4 h-4 text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {t('basket.substituteBestMatch')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 shrink-0">
                    {t('basket.cheapestOption')}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                  {t('basket.bestMatchHelp')}
                </p>
              </div>
            </label>

            {/* OPTION 2: PRE-CHOOSE SUBSTITUTE */}
            <div
              className={`p-4 transition-colors ${
                preference === 'CUSTOMER_SELECTED' ? 'bg-emerald-50/40' : 'hover:bg-gray-50/70'
              }`}
            >
              <label
                htmlFor="pref-customer-selected"
                className="flex items-start gap-3.5 cursor-pointer"
              >
                <div className="pt-0.5">
                  <input
                    type="radio"
                    id="pref-customer-selected"
                    name="substitution-preference"
                    value="CUSTOMER_SELECTED"
                    checked={preference === 'CUSTOMER_SELECTED'}
                    on{t('basket.change')}={() => setPreference('CUSTOMER_SELECTED')}
                    className="w-4 h-4 text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-900">
                      {t('basket.preChooseSubstitute')}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 shrink-0">
                      {t('basket.bufferAdjusted')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                    {t('basket.preChooseHelp')}
                  </p>
                </div>
              </label>

              {/* EXPANDED ALTERNATIVE SELECTION PANEL */}
              {preference === 'CUSTOMER_SELECTED' && (
                <div className="mt-3.5 pt-3 border-t border-emerald-200/60 pl-7 space-y-2.5">
                  {/* Selected alternative display */}
                  {preferredPlu ? (
                    <div className="p-3 bg-white rounded-xl border border-emerald-300 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {selectedAlternativeProduct?.imageUrl ? (
                            <img
                              src={selectedAlternativeProduct.imageUrl}
                              alt={selectedAlternativeProduct.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-gray-900 block truncate">
                            {selectedAlternativeProduct?.name || item.preferredSubstituteName || preferredPlu}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono text-gray-600">
                              {formatCurrency(selectedAlternativePriceMajor, currencySymbol)}
                            </span>
                            {priceDifferenceMajor > 0 ? (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-extrabold text-[10px]">
                                +{currencySymbol}{priceDifferenceMajor.toFixed(2)} {t('basket.buffer')}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                {t('basket.sameOrCheaper')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsChoosingAlternative(true)}
                        className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg shrink-0 transition-colors"
                      >
                        {t('basket.change')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsChoosingAlternative(true)}
                      className="w-full py-2.5 px-3 bg-white border-2 border-dashed border-emerald-400 hover:border-emerald-600 rounded-xl text-xs font-bold text-emerald-700 flex items-center justify-center gap-2 transition-colors shadow-2xs"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>{t('basket.selectAlternative')}</span>
                    </button>
                  )}

                  {/* High Value Buffer Notice */}
                  {priceDifferenceMajor > 0 && (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="leading-snug">
                        <strong>{t('basket.preAuthBufferUpdate')}:</strong> {t('basket.extra')}{' '}
                        <strong>{currencySymbol}{(priceDifferenceMajor * quantity).toFixed(2)}</strong> (
                        +{currencySymbol}{priceDifferenceMajor.toFixed(2)} × {quantity}) {t('basket.bufferNoticeSuffix')}
                      </p>
                    </div>
                  )}

                  {/* PRODUCT PICKER DRAWER / SHEET */}
                  {isChoosingAlternative && (
                    <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-800">
                          {t('basket.chooseAlternativeProduct')}:
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsChoosingAlternative(false)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Search bar inside alternative picker */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchFilter}
                          on{t('basket.change')}={(e) => setSearchFilter(e.target.value)}
                          placeholder={t('basket.searchAlternatives')}
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-emerald-600"
                        />
                      </div>

                      {/* Alternatives List */}
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {availableAlternatives.map((alt) => {
                          const altPriceMajor = moneyToMajor(alt.price);
                          const diff = altPriceMajor - originalPriceMajor;
                          const isSelected = preferredPlu === alt.plu;

                          return (
                            <div
                              key={alt.plu}
                              onClick={() => handleSelectAlternative(alt)}
                              className={`p-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-emerald-100 border border-emerald-400'
                                  : 'bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-md bg-gray-50 overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                                  {alt.imageUrl ? (
                                    <img
                                      src={alt.imageUrl}
                                      alt={alt.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Package className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[11px] font-bold text-gray-900 block truncate max-w-[170px]">
                                    {alt.name}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-mono block">
                                    {formatCurrency(alt.price, currencySymbol)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {diff > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900">
                                    +{currencySymbol}{diff.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                                    {t('basket.noPriceDifference')}
                                  </span>
                                )}
                                {isSelected && (
                                  <Check className="w-4 h-4 text-emerald-700 stroke-[3]" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* OPTION 3: REMOVE ITEM */}
            <label
              htmlFor="pref-remove-item"
              className={`flex items-start gap-3.5 p-4 cursor-pointer transition-colors ${
                preference === 'REMOVE_IF_UNAVAILABLE' ? 'bg-emerald-50/40' : 'hover:bg-gray-50/70'
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="radio"
                  id="pref-remove-item"
                  name="substitution-preference"
                  value="REMOVE_IF_UNAVAILABLE"
                  checked={preference === 'REMOVE_IF_UNAVAILABLE'}
                  on{t('basket.change')}={() => setPreference('REMOVE_IF_UNAVAILABLE')}
                  className="w-4 h-4 text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {t('basket.removeIfUnavailable')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-gray-100 text-gray-700 shrink-0">
                    {t('basket.autoRefund')}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                  {t('basket.removeUnavailableHelp')}
                </p>
              </div>
            </label>

            {/* OPTION 4: CANCEL ENTIRE ORDER */}
            <label
              htmlFor="pref-cancel-order"
              className={`flex items-start gap-3.5 p-4 cursor-pointer transition-colors ${
                preference === 'CANCEL_ORDER_IF_UNAVAILABLE' ? 'bg-emerald-50/40' : 'hover:bg-gray-50/70'
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="radio"
                  id="pref-cancel-order"
                  name="substitution-preference"
                  value="CANCEL_ORDER_IF_UNAVAILABLE"
                  checked={preference === 'CANCEL_ORDER_IF_UNAVAILABLE'}
                  on{t('basket.change')}={() => setPreference('CANCEL_ORDER_IF_UNAVAILABLE')}
                  className="w-4 h-4 text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {t('basket.cancelIfUnavailable')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-800 shrink-0">
                    {t('basket.essentialItem')}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1 leading-snug">
                  {t('basket.ifItemUnavailable')}, do not deliver. Your entire order will be cancelled with no charge.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* BOTTOM UPDATE BUTTON */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            id="modal-update-btn"
            onClick={handleSave}
            style={primaryBtnStyle}
            className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-center shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <span>{t('basket.update')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
