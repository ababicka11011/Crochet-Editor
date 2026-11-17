import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Własny padding (domyślnie px-2.5 py-1). */
  pad?: string;
}

export function Button({ active, pad = 'px-2.5 py-1', className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-sm border text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black enabled:cursor-pointer enabled:hover:bg-neutral-200 disabled:border-neutral-300 disabled:text-neutral-400 ${pad} ${
        active ? 'border-black bg-neutral-200 font-semibold' : 'border-neutral-400 bg-white'
      } ${className}`}
    />
  );
}