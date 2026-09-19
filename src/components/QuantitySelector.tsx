import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { useTenantStyles } from '../tenant/useTenant';

interface QuantitySelectorProps {
  quantity: number;
  maxQuantity?: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  maxQuantity = 99,
  onIncrement,
  onDecrement,
  disabled = false,
  size = 'md',
}) => {
  const { primaryBtnStyle } = useTenantStyles();

  const isAtMax = quantity >= maxQuantity;

  const sizeClasses = {
    sm: 'h-8 text-xs px-1',
    md: 'h-9 text-sm px-1.5',
    lg: 'h-11 text-base px-2',
  }[size];

  const btnClasses = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  }[size];

  return (
    <div
      id="quantity-stepper"
      className={`inline-flex items-center justify-between gap-1.5 bg-gray-100 rounded-full font-semibold shadow-xs ${sizeClasses}`}
    >
      <button
        type="button"
        id="quantity-minus-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDecrement();
        }}
        disabled={disabled || quantity <= 0}
        aria-label="Decrease quantity"
        className={`flex items-center justify-center rounded-full bg-white text-gray-700 hover:bg-gray-200 transition-colors shadow-xs active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${btnClasses}`}
      >
        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>

      <span className="min-w-6 text-center font-bold text-gray-900 select-none">
        {quantity}
      </span>

      <button
        type="button"
        id="quantity-plus-btn"
        onClick={(e) => {
          e.stopPropagation();
          if (!isAtMax) onIncrement();
        }}
        disabled={disabled || isAtMax}
        style={!isAtMax ? primaryBtnStyle : undefined}
        aria-label="Increase quantity"
        className={`flex items-center justify-center rounded-full transition-all shadow-xs active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed ${btnClasses}`}
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>
    </div>
  );
};
