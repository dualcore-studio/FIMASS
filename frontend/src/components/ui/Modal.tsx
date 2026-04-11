import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={`flex max-h-[90vh] w-full cursor-default flex-col rounded-xl border border-slate-200/95 bg-white shadow-[0_24px_48px_-12px_rgba(15,23,42,0.2),0_0_0_1px_rgba(15,23,42,0.04)] ${sizes[size]}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/90 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 text-slate-700">{children}</div>
      </div>
    </div>
  );
}
