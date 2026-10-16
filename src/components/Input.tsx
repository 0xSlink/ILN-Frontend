import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input: React.FC<InputProps> = ({
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
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={
          `flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d627f] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500 ring-red-500' : ''} ` +
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
