import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  className,
  error,
  id,
  label,
  'aria-describedby': ariaDescribedBy,
  ...props
}) => {
  const errorId = id && error ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && id && (
        <label htmlFor={id} className="block text-sm font-medium text-muted-foreground mb-1">
          {label}
        </label>
      )}
      <textarea
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={
          `flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d627f] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500 ring-red-500' : ''} ` +
          (className || '')
        }
        {...props}
      />
      {error && errorId && (
        <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
