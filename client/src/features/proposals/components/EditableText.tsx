/**
 * EditableText Component
 *
 * Reusable inline editing component using contentEditable.
 * Auto-saves on blur and supports various HTML elements.
 */

import { useRef, useEffect, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

type EditableElement = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'div' | 'li';

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  as?: EditableElement;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}

export function EditableText({
  value,
  onChange,
  onBlur,
  className,
  as: Tag = 'p',
  placeholder = 'Click to edit...',
  multiline = false,
  disabled = false,
}: EditableTextProps) {
  const ref = useRef<HTMLElement>(null);
  const isComposing = useRef(false);

  // Sync value changes from parent
  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  const handleBlur = () => {
    if (ref.current) {
      const newValue = ref.current.innerText;
      if (newValue !== value) {
        onChange(newValue);
      }
    }
    onBlur?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // Prevent Enter from creating new lines in single-line mode
    if (!multiline && e.key === 'Enter' && !isComposing.current) {
      e.preventDefault();
      ref.current?.blur();
    }
    // Allow Escape to cancel editing
    if (e.key === 'Escape') {
      if (ref.current) {
        ref.current.innerText = value;
      }
      ref.current?.blur();
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = () => {
    isComposing.current = false;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!multiline) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain').replace(/\n/g, ' ');
      document.execCommand('insertText', false, text);
    }
  };

  const isEmpty = !value || value.trim() === '';

  return (
    <Tag
      ref={ref as any}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onPaste={handlePaste}
      className={cn(
        "outline-none transition-colors rounded",
        "focus:bg-blue-50 focus:ring-1 focus:ring-blue-200",
        "hover:bg-gray-50",
        !disabled && "cursor-text",
        disabled && "cursor-default",
        isEmpty && "text-gray-400",
        className
      )}
      data-placeholder={placeholder}
      style={{
        minHeight: multiline ? '4em' : undefined,
      }}
    >
      {value || (disabled ? '' : placeholder)}
    </Tag>
  );
}

/**
 * EditableList Component
 *
 * Editable bullet list with add/remove capabilities.
 */
interface EditableListProps {
  items: string[];
  onChange: (items: string[]) => void;
  onBlur?: () => void;
  className?: string;
  itemClassName?: string;
  placeholder?: string;
  ordered?: boolean;
  disabled?: boolean;
}

export function EditableList({
  items,
  onChange,
  onBlur,
  className,
  itemClassName,
  placeholder = 'Click to edit item...',
  ordered = false,
  disabled = false,
}: EditableListProps) {
  const Tag = ordered ? 'ol' : 'ul';

  const updateItem = (index: number, newValue: string) => {
    const newItems = [...items];
    newItems[index] = newValue;
    onChange(newItems);
  };

  const addItem = () => {
    onChange([...items, '']);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      onChange(items.filter((_, i) => i !== index));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Add new item after current
      const newItems = [...items];
      newItems.splice(index + 1, 0, '');
      onChange(newItems);
      // Focus new item after render
      setTimeout(() => {
        const listItems = document.querySelectorAll(`[data-list-index="${index + 1}"]`);
        if (listItems.length > 0) {
          (listItems[0] as HTMLElement).focus();
        }
      }, 0);
    }
    if (e.key === 'Backspace' && items[index] === '' && items.length > 1) {
      e.preventDefault();
      removeItem(index);
    }
  };

  return (
    <Tag className={cn("space-y-1", ordered ? "list-decimal" : "list-disc", "pl-6", className)}>
      {items.map((item, index) => (
        <li key={index} className="group">
          <div className="flex items-start gap-2">
            <EditableText
              value={item}
              onChange={(v) => updateItem(index, v)}
              onBlur={onBlur}
              as="span"
              placeholder={placeholder}
              disabled={disabled}
              className={cn("flex-1", itemClassName)}
            />
            {!disabled && items.length > 1 && (
              <button
                onClick={() => removeItem(index)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity text-sm"
                title="Remove item"
              >
                ×
              </button>
            )}
          </div>
        </li>
      ))}
      {!disabled && (
        <li className="list-none -ml-6">
          <button
            onClick={addItem}
            className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            <span>+</span> Add item
          </button>
        </li>
      )}
    </Tag>
  );
}
