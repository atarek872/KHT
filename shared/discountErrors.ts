export function discountErrorArabic(message: string) {
  if (message === 'Coupon code was not found.') return 'كود الخصم غير موجود.'
  if (message === 'This coupon is inactive.') return 'كود الخصم غير مفعّل حاليًا.'
  if (message === 'This coupon is not active yet.') return 'كود الخصم لم يبدأ بعد.'
  if (message === 'This coupon has expired.') return 'انتهت صلاحية كود الخصم.'
  if (message === 'This coupon has reached its usage limit.')
    return 'اكتمل عدد مرات استخدام كود الخصم.'
  if (message.startsWith('This coupon requires a minimum order of '))
    return message.replace(
      'This coupon requires a minimum order of ',
      'الحد الأدنى لاستخدام الكود هو ',
    )
  if (message === 'This coupon is available to signed-in customers only.')
    return 'سجّل دخولك لاستخدام كود الخصم.'
  if (message === 'This coupon has already been used by this account.')
    return 'تم استخدام كود الخصم من هذا الحساب من قبل.'
  if (message === 'This coupon is available on your first order only.')
    return 'كود الخصم متاح لأول طلب فقط.'
  return 'تعذر التحقق من الخصم الآن. حاول مرة أخرى.'
}
