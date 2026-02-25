'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatAmount, formatInteger, parseAmountInput, parseIntegerInput } from '@/utils/number-format';

type NumberMode = 'integer' | 'amount';

interface NumberInputProps {
  value: number | null | undefined;
  onValueChange: (nextValue: number) => void;
  mode?: NumberMode;
  min?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function NumberInput({
  value,
  onValueChange,
  mode = 'integer',
  min = 0,
  placeholder,
  className,
  disabled,
}: NumberInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [rawInput, setRawInput] = useState('');

  const safeValue = useMemo(() => {
    const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return Math.max(min, numericValue);
  }, [min, value]);

  useEffect(() => {
    if (isFocused) return;
    setRawInput(mode === 'amount' ? formatAmount(safeValue) : formatInteger(safeValue));
  }, [isFocused, mode, safeValue]);

  const parseByMode = (input: string): number | null => {
    return mode === 'amount' ? parseAmountInput(input) : parseIntegerInput(input);
  };

  return (
    <input
      type="text"
      inputMode={mode === 'amount' ? 'decimal' : 'numeric'}
      value={rawInput}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      onFocus={() => {
        setIsFocused(true);
        setRawInput(String(safeValue));
      }}
      onBlur={() => {
        setIsFocused(false);
        const parsed = parseByMode(rawInput);
        const next = Math.max(min, parsed ?? 0);
        onValueChange(next);
        setRawInput(mode === 'amount' ? formatAmount(next) : formatInteger(next));
      }}
      onChange={(event) => {
        const nextRaw = event.target.value;
        setRawInput(nextRaw);
        const parsed = parseByMode(nextRaw);
        if (parsed === null) return;
        onValueChange(Math.max(min, parsed));
      }}
    />
  );
}
