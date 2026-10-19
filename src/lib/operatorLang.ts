'use client';

import { useSyncExternalStore } from 'react';

export type OperatorLang = 'en' | 'id';

const STORAGE_KEY = 'quickpic_operator_lang';
const listeners = new Set<() => void>();

function readStored(): OperatorLang | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'en' || v === 'id' ? v : null;
  } catch {
    return null;
  }
}

function getSnapshot(): OperatorLang {
  return readStored() ?? (navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en');
}

function getServerSnapshot(): OperatorLang {
  return 'en';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setOperatorLang(lang: OperatorLang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
  listeners.forEach((l) => l());
}

export function useOperatorLang(): OperatorLang {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
