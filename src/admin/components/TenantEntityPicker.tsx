import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type TenantEntityKind,
  type TenantEntityOption,
  type TenantEntityPickerContract,
  type TenantEntityPickerState,
  type TenantEntityRef,
  tenantEntityPickerState,
  validateTenantEntityOptions,
} from '../tenantEntityPicker';

interface TenantEntityPickerProps<K extends TenantEntityKind> {
  contract: TenantEntityPickerContract<K>;
  onChange: (selected: readonly TenantEntityRef<K>[]) => void;
  selectedOptions?: readonly TenantEntityOption<K>[];
  label?: string;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  maxResults?: number;
}

export function TenantEntityPicker<K extends TenantEntityKind>({
  contract,
  onChange,
  selectedOptions = [],
  label,
  placeholder = 'Search...',
  emptyMessage = 'No matching items.',
  disabled = false,
  maxResults = 50,
}: TenantEntityPickerProps<K>) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<TenantEntityPickerState<K>>({
    status: 'idle',
    options: [],
  });
  const requestId = useRef(0);

  useEffect(() => {
    setQuery('');
    setState({ status: 'idle', options: [] });
  }, [contract.tenantId, contract.kind]);

  useEffect(() => {
    if (disabled) return;
    const id = ++requestId.current;
    const abortController = new AbortController();
    setState({ status: 'loading', options: [] });

    Promise.resolve(
      contract.source({
        tenantId: contract.tenantId,
        kind: contract.kind,
        query,
        signal: abortController.signal,
      }),
    )
      .then((rawOptions) => {
        if (abortController.signal.aborted || id !== requestId.current) return;
        const options = validateTenantEntityOptions(
          { tenantId: contract.tenantId, kind: contract.kind },
          rawOptions,
        ).slice(0, maxResults);
        setState(tenantEntityPickerState(options));
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted || id !== requestId.current) return;
        setState({
          status: 'error',
          options: [],
          message: error instanceof Error ? error.message : 'Could not load options.',
        });
      });

    return () => abortController.abort();
  }, [
    contract.tenantId,
    contract.kind,
    contract.source,
    disabled,
    maxResults,
    query,
  ]);

  const selectedLookup = useMemo(() => {
    const lookup = new Map<string, TenantEntityOption<K>>();
    for (const option of selectedOptions) {
      if (option.kind === contract.kind) lookup.set(option.value, option);
    }
    for (const option of state.options) {
      lookup.set(option.value, option);
    }
    return lookup;
  }, [contract.kind, selectedOptions, state.options]);

  const selectedValues = useMemo(
    () => new Set(contract.selected.map((item) => item.value)),
    [contract.selected],
  );

  const selectOption = (option: TenantEntityOption<K>) => {
    const ref: TenantEntityRef<K> = { kind: contract.kind, value: option.value };
    if (!contract.multiple) {
      onChange([ref]);
      setQuery('');
      return;
    }
    if (selectedValues.has(option.value)) {
      onChange(contract.selected.filter((item) => item.value !== option.value));
      return;
    }
    onChange([...contract.selected, ref]);
    setQuery('');
  };

  const removeSelected = (value: string) => {
    onChange(contract.selected.filter((item) => item.value !== value));
  };

  return (
    <div className="min-w-0 space-y-2">
      {label && (
        <label className="block text-[11px] font-bold text-gray-700">
          {label}
        </label>
      )}

      {contract.selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label={`${label || contract.kind} selected items`}>
          {contract.selected.map((item) => {
            const resolved = selectedLookup.get(item.value);
            return (
              <span
                key={`${item.kind}:${item.value}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-800"
              >
                <span className="truncate">
                  {resolved?.label || `Selected ${contract.kind}`}
                </span>
                <button
                  type="button"
                  onClick={() => removeSelected(item.value)}
                  disabled={disabled}
                  className="rounded-full px-0.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800 disabled:opacity-40"
                  aria-label={`Remove ${resolved?.label || contract.kind}`}
                >
                  x
                </button>
              </span>
            );
          })}
          {contract.selected.length > 1 && (
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={disabled}
              className="text-[10px] font-bold text-gray-500 underline hover:text-gray-800 disabled:opacity-40"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label || `Search ${contract.kind}`}
        className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-100 disabled:text-gray-400"
      />

      <div className="min-h-5" aria-live="polite">
        {state.status === 'loading' && (
          <p className="text-[10px] font-semibold text-gray-500">Loading options...</p>
        )}
        {state.status === 'error' && (
          <p role="alert" className="text-[10px] font-semibold text-rose-700">
            {state.message}
          </p>
        )}
        {state.status === 'empty' && (
          <p className="text-[10px] font-semibold text-gray-500">{emptyMessage}</p>
        )}
      </div>

      {state.status === 'ready' && (
        <div
          role="listbox"
          aria-multiselectable={contract.multiple || undefined}
          className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
        >
          {state.options.map((option) => {
            const isSelected = selectedValues.has(option.value);
            return (
              <button
                key={`${option.kind}:${option.value}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectOption(option)}
                className={`flex w-full min-w-0 items-start justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{option.label}</span>
                  {option.description && (
                    <span className="mt-0.5 block truncate text-[10px] font-medium text-gray-500">
                      {option.description}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <span className="shrink-0 text-[10px] font-extrabold text-indigo-700">
                    Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
