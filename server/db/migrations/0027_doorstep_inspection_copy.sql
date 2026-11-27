UPDATE storefront_content_state SET
  draft_json = json_set(draft_json,
    '$.pages.shipping.hero.body', json_object(
      'en', 'Inspect your order while the courier waits. If the product is not right for you, decline delivery and hand it back. Your legal rights remain protected.',
      'ar', 'افحص طلبك والمندوب منتظر. لو المنتج مش مناسب لك، ارفض الاستلام ورجّعه للمندوب. حقوقك القانونية محفوظة.'),
    '$.pages.shipping.sections[1].body', json_object(
      'en', 'Open and inspect the parcel while the courier waits. Check the product, quantity, size, colour and visible condition before accepting it. If the item is not right for you, decline delivery and give it back to the courier, then contact KHT with your order number. If inspection cannot take place, contact us for help. Inspecting or accepting the parcel does not waive your statutory exchange or return rights.',
      'ar', 'افتح الشحنة وافحصها والمندوب منتظر. اتأكد من المنتج والعدد والمقاس واللون والحالة قبل الاستلام. لو المنتج مش مناسب لك، ارفض الاستلام ورجّعه للمندوب، وبعدها تواصل مع KHT برقم الطلب. لو ما قدرتش تفحص الشحنة، تواصل معانا للمساعدة. الفحص أو الاستلام لا يلغي حقوقك القانونية في الاستبدال أو الاسترجاع.')),
  published_json = json_set(published_json,
    '$.pages.shipping.hero.body', json_object(
      'en', 'Inspect your order while the courier waits. If the product is not right for you, decline delivery and hand it back. Your legal rights remain protected.',
      'ar', 'افحص طلبك والمندوب منتظر. لو المنتج مش مناسب لك، ارفض الاستلام ورجّعه للمندوب. حقوقك القانونية محفوظة.'),
    '$.pages.shipping.sections[1].body', json_object(
      'en', 'Open and inspect the parcel while the courier waits. Check the product, quantity, size, colour and visible condition before accepting it. If the item is not right for you, decline delivery and give it back to the courier, then contact KHT with your order number. If inspection cannot take place, contact us for help. Inspecting or accepting the parcel does not waive your statutory exchange or return rights.',
      'ar', 'افتح الشحنة وافحصها والمندوب منتظر. اتأكد من المنتج والعدد والمقاس واللون والحالة قبل الاستلام. لو المنتج مش مناسب لك، ارفض الاستلام ورجّعه للمندوب، وبعدها تواصل مع KHT برقم الطلب. لو ما قدرتش تفحص الشحنة، تواصل معانا للمساعدة. الفحص أو الاستلام لا يلغي حقوقك القانونية في الاستبدال أو الاسترجاع.'))
WHERE id = 1
  AND json_extract(published_json, '$.pages.shipping.sections[1].id') = 'inspection';
