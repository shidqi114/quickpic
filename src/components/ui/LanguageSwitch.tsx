'use client';

import React from 'react';
import { setOperatorLang, useOperatorLang } from '@/lib/operatorLang';

export const LanguageSwitch: React.FC<{ className?: string }> = ({ className = '' }) => {
  const lang = useOperatorLang();
  return (
    <div role="group" aria-label="Language" className={`inline-flex gap-1 ${className}`}>
      {(['en', 'id'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setOperatorLang(code)}
          aria-pressed={lang === code}
          className={`h-10 px-3 rounded border text-[15px] cursor-pointer ${lang === code ? 'border-ink bg-ink text-white' : 'border-paper-control hover:bg-paper-surface'}`}
        >
          {code === 'en' ? 'English' : 'Indonesia'}
        </button>
      ))}
    </div>
  );
};
