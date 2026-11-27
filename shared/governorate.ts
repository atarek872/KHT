const arabicGovernorates: Record<string, string> = {
  Alexandria: 'الإسكندرية',
  Assiut: 'أسيوط',
  Aswan: 'أسوان',
  Beheira: 'البحيرة',
  'Beni Suef': 'بني سويف',
  Cairo: 'القاهرة',
  Dakahlia: 'الدقهلية',
  Damietta: 'دمياط',
  Fayoum: 'الفيوم',
  Giza: 'الجيزة',
  Ismailia: 'الإسماعيلية',
  'Kafr El Sheikh': 'كفر الشيخ',
  Luxor: 'الأقصر',
  Matrouh: 'مطروح',
  Minya: 'المنيا',
  Monufia: 'المنوفية',
  'New Valley': 'الوادي الجديد',
  'North Sinai': 'شمال سيناء',
  'Port Said': 'بورسعيد',
  Qalyubia: 'القليوبية',
  Qena: 'قنا',
  Qharbia: 'الغربية',
  'Red Sea': 'البحر الأحمر',
  Sharqia: 'الشرقية',
  Sohag: 'سوهاج',
  'South Sinai': 'جنوب سيناء',
  Suez: 'السويس',
}

export function governorateLabel(name: string, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? arabicGovernorates[name] || name : name
}
