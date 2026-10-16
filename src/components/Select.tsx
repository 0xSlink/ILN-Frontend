'use client';

import React, { useRef, useState, useId, useEffect, Children, isValidElement } from 'react';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement | HTMLButtonElement>) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  native?: boolean;
  children?: React.ReactNode;
  options?: SelectOption[];
};

function NativeSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children?: React.ReactNode }) {
  return (
    <select className={className} {...props}>
      {children}
    </select>
  );
}

export const Select: React.FC<SelectProps> = ({
  id,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled = false,
  required = false,
  name,
  placeholder = 'Select...',
  className,
  ariaLabel,
  ariaLabelledBy,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
  native = false,
  children,
  options: optionsProp,
}) => {
  const comboId = useId();
  const listboxId = `${comboId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const selectedValue = isControlled ? value : internalValue;

  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const parsedOptions: SelectOption[] = optionsProp ?? [];
  const enabledOptions = parsedOptions.filter((o) => !o.disabled);
  const selectedOption = parsedOptions.find((o) => o.value === selectedValue);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[focusedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, open]);

  // Focus the list when it opens
  useEffect(() => {
    if (open && listRef.current) listRef.current.focus();
  }, [open]);

  function selectValue(val: string) {
    if (!isControlled) setInternalValue(val);
    const syntheticEvent = {
      target: { value: val },
    } as React.ChangeEvent<HTMLSelectElement>;
    onChange?.(syntheticEvent);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function openList() {
    if (disabled) return;
    const currentIdx = enabledOptions.findIndex((o) => o.value === selectedValue);
    setFocusedIndex(currentIdx >= 0 ? currentIdx : 0);
    setOpen(true);
  }

  function handleButtonKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        openList();
        break;
      default:
        break;
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const count = enabledOptions.length;
    if (count === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        // Wrap: last → first
        setFocusedIndex((i) => (i + 1) % count);
        break;

      case 'ArrowUp':
        e.preventDefault();
        // Wrap: first → last
        setFocusedIndex((i) => (i - 1 + count) % count);
        break;

      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setFocusedIndex(count - 1);
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < count) {
          selectValue(enabledOptions[focusedIndex].value);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;

      case 'Tab':
        setOpen(false);
        break;

      default:
        // Type-ahead: jump to first option starting with pressed key
        {
          const char = e.key.toLowerCase();
          if (char.length === 1) {
            const match = enabledOptions.findIndex((o) => o.label.toLowerCase().startsWith(char));
            if (match >= 0) setFocusedIndex(match);
          }
        }
        break;
    }
  }

  // ── Native fallback ──────────────────────────────────────────────────────
  const hasNativeOptions = Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === 'option'
  );
  if (native || hasNativeOptions) {
    return (
      <NativeSelect
        id={id ?? comboId}
        name={name}
        value={selectedValue}
        onChange={(e) => {
          if (!isControlled) setInternalValue(e.target.value);
          onChange?.(e);
        }}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid}
        className={className}
      >
        {children}
      </NativeSelect>
    );
  }

  // ── Custom listbox ───────────────────────────────────────────────────────
  const activeDescendant =
    open && focusedIndex >= 0 ? `${listboxId}-option-${focusedIndex}` : undefined;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden native input for form submission */}
      {name && <input type="hidden" name={name} value={selectedValue} required={required} />}

      {/* Combobox button */}
      <button
        ref={buttonRef}
        id={comboId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-required={required}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleButtonKeyDown}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedOption ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span
          className={`material-symbols-outlined ml-2 shrink-0 text-base text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {/* Listbox dropdown */}
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel ?? 'Options'}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-background py-1 text-sm shadow-lg focus:outline-none"
        >
          {parsedOptions.map((option) => {
            const enabledIdx = enabledOptions.indexOf(option);
            const isFocused = enabledIdx === focusedIndex && !option.disabled;
            const isSelected = option.value === selectedValue;

            return (
              <li
                key={option.value}
                id={`${listboxId}-option-${enabledIdx}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onClick={() => {
                  if (!option.disabled) selectValue(option.value);
                }}
                onMouseEnter={() => {
                  if (!option.disabled) setFocusedIndex(enabledIdx);
                }}
                className={[
                  'flex cursor-default select-none items-center px-3 py-2 transition-colors',
                  option.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                  isFocused && !option.disabled
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-accent',
                  isSelected ? 'font-bold' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {isSelected && (
                  <span
                    className="material-symbols-outlined mr-2 text-sm text-primary"
                    aria-hidden="true"
                  >
                    check
                  </span>
                )}
                {!isSelected && <span className="mr-6" aria-hidden="true" />}
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Select;
