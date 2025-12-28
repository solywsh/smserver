'use client';

import { useState, KeyboardEvent, ClipboardEvent } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PhoneNumberInputProps {
  value: string; // Semicolon-separated phone numbers
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneNumberInput({
  value,
  onChange,
  placeholder = 'Enter phone number...',
  className,
}: PhoneNumberInputProps) {
  const [inputValue, setInputValue] = useState('');

  // Parse semicolon-separated string into array
  const phoneNumbers = value
    ? value.split(';').filter((n) => n.trim())
    : [];

  const addPhoneNumber = (number: string) => {
    const trimmed = number.trim();
    if (!trimmed) return;

    // Add to the list if not already present
    if (!phoneNumbers.includes(trimmed)) {
      const newNumbers = [...phoneNumbers, trimmed];
      onChange(newNumbers.join(';'));
    }
    setInputValue('');
  };

  const removePhoneNumber = (number: string) => {
    const newNumbers = phoneNumbers.filter((n) => n !== number);
    onChange(newNumbers.join(';'));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addPhoneNumber(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && phoneNumbers.length > 0) {
      // Remove last tag if backspace is pressed on empty input
      removePhoneNumber(phoneNumbers[phoneNumbers.length - 1]);
    }
  };

  const handleBlur = () => {
    // Add the current input value when focus is lost
    if (inputValue.trim()) {
      addPhoneNumber(inputValue);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    // Handle pasting multiple numbers (comma or semicolon separated)
    const pastedText = e.clipboardData.getData('text');
    const numbers = pastedText.split(/[;,]/).map((n) => n.trim()).filter(Boolean);

    if (numbers.length > 1) {
      e.preventDefault();
      numbers.forEach((num) => {
        if (!phoneNumbers.includes(num)) {
          phoneNumbers.push(num);
        }
      });
      onChange(phoneNumbers.join(';'));
      setInputValue('');
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1.5 p-2 border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
    >
      {phoneNumbers.map((number) => (
        <Badge
          key={number}
          variant="secondary"
          className="gap-1 pl-2 pr-1 py-1 h-7"
        >
          <span className="font-mono text-xs">{number}</span>
          <button
            type="button"
            onClick={() => removePhoneNumber(number)}
            className="hover:bg-secondary-foreground/20 rounded-sm p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPaste={handlePaste}
        placeholder={phoneNumbers.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 h-7 px-1"
      />
    </div>
  );
}
