import { OperatorLang, useOperatorLang } from '@/lib/operatorLang';

const EN = {
  'settings.title': 'Booth and event settings',
  'settings.close': 'Close',
  'settings.event': 'Event',
  'settings.nameLabel': 'Name at the top of the strip',
  'settings.namePlaceholder': "e.g. Alex and Sam's wedding",
  'settings.dateLabel': 'Date',
  'settings.datePlaceholder': 'e.g. SEP 2026',
  'settings.hashtagLabel': 'Hashtag',
  'settings.hashtagPlaceholder': 'e.g. #AlexSam2026',
  'settings.layout': 'Strip layout',
  'settings.layout.strip3': '3-photo strip',
  'settings.layout.strip4': '4-photo strip',
  'settings.layout.grid2x2': '2 × 2 grid',
  'settings.layout.single': 'Single portrait',
  'settings.photos': '{n} photos',
  'settings.photo': '{n} photo',
  'settings.background': 'Background',
  'settings.camera': 'Camera',
  'settings.filterLabel': 'Starting look for every photo',
  'settings.countdownLabel': 'Countdown before each photo',
  'settings.seconds': '{n} seconds',
  'settings.mirror': 'Mirror the camera',
  'settings.mirrorHint': 'Shows the preview the way a mirror does.',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.save': 'Save and close',
  'settings.filter.none': 'Normal',
  'settings.filter.bw': 'Black and white',
  'settings.filter.warm': 'Warm glow',
  'settings.filter.vintage': 'Vintage',
  'settings.filter.sepia': 'Sepia',
  'settings.filter.cyberpunk': 'Neon',
  'settings.filter.cold': 'Cool blue',
  'settings.open': 'Booth settings',
} as const;

export type OperatorKey = keyof typeof EN;

const ID: Record<OperatorKey, string> = {
  'settings.title': 'Pengaturan booth dan acara',
  'settings.close': 'Tutup',
  'settings.event': 'Acara',
  'settings.nameLabel': 'Nama di bagian atas strip',
  'settings.namePlaceholder': 'mis. Pernikahan Alex dan Sam',
  'settings.dateLabel': 'Tanggal',
  'settings.datePlaceholder': 'mis. SEP 2026',
  'settings.hashtagLabel': 'Tagar',
  'settings.hashtagPlaceholder': 'mis. #AlexSam2026',
  'settings.layout': 'Tata letak strip',
  'settings.layout.strip3': 'Strip 3 foto',
  'settings.layout.strip4': 'Strip 4 foto',
  'settings.layout.grid2x2': 'Kisi 2 × 2',
  'settings.layout.single': 'Potret tunggal',
  'settings.photos': '{n} foto',
  'settings.photo': '{n} foto',
  'settings.background': 'Latar belakang',
  'settings.camera': 'Kamera',
  'settings.filterLabel': 'Tampilan awal untuk setiap foto',
  'settings.countdownLabel': 'Hitung mundur sebelum setiap foto',
  'settings.seconds': '{n} detik',
  'settings.mirror': 'Cerminkan kamera',
  'settings.mirrorHint': 'Pratinjau ditampilkan seperti di cermin.',
  'settings.on': 'Nyala',
  'settings.off': 'Mati',
  'settings.save': 'Simpan dan tutup',
  'settings.filter.none': 'Normal',
  'settings.filter.bw': 'Hitam putih',
  'settings.filter.warm': 'Cahaya hangat',
  'settings.filter.vintage': 'Vintage',
  'settings.filter.sepia': 'Sepia',
  'settings.filter.cyberpunk': 'Neon',
  'settings.filter.cold': 'Biru dingin',
  'settings.open': 'Pengaturan booth',
};

export const OPERATOR_STRINGS: Record<OperatorLang, Record<OperatorKey, string>> = { en: EN, id: ID };

export function translate(lang: OperatorLang, key: OperatorKey, vars?: Record<string, string | number>): string {
  let text: string = OPERATOR_STRINGS[lang][key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export function useOperatorT() {
  const lang = useOperatorLang();
  return {
    lang,
    t: (key: OperatorKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
  };
}
