import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const toggleBtnClass =
  'absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--ui-primary)_10%,transparent)] hover:text-[var(--ui-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus-ring)]';

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  wrapperClassName?: string;
};

export function PasswordInput({
  className = 'input-field',
  wrapperClassName = '',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputClass = `${className} pr-11`.trim();

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <input {...props} type={visible ? 'text' : 'password'} className={inputClass} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className={toggleBtnClass}
        aria-label={visible ? 'Nascondi password' : 'Mostra password'}
      >
        {visible ? (
          <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        ) : (
          <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </div>
  );
}
