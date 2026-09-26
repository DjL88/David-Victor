import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  dismissible?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  id?: string;
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-4xl',
};

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  dismissible = true,
  size = 'lg',
  children,
  footer,
  className = '',
  headerAction,
  id = 'modal-shell',
}) => {
  // Close on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        onClose();
      }
    },
    [dismissible, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      id={`${id}-backdrop`}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        id={id}
        className={`w-full min-w-0 ${SIZE_CLASSES[size]} bg-white rounded-3xl p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col my-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        {(title || icon || dismissible) && (
          <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && <div className="shrink-0">{icon}</div>}
              {title && (
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 truncate">{title}</h2>
                  {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerAction}
              {dismissible && (
                <button
                  type="button"
                  id={`${id}-close-button`}
                  onClick={onClose}
                  className="p-3 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-auto overscroll-contain min-h-0 min-w-0 break-words">{children}</div>

        {/* Modal Footer */}
        {footer && <div className="mt-4 pt-3 border-t border-gray-100 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};
