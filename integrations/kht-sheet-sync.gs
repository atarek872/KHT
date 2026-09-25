// Bound to the KHT Brand Management Google Sheet. Keep the token in Script Properties.
const KHT_SPREADSHEET_ID = '12UEC1ET-W03L52gWvz23-c71n9sdEV-tDqxpmBAEtr8';
const KHT_EXPORT_URL = 'https://kht-eg.com/api/integrations/sheet-export';

const KHT_ORDER_HEADERS = [
  'Order number', 'Order date', 'Channel', 'Website SKU', 'Product', 'Variant',
  'Quantity', 'Unit price (EGP)', 'Line total (EGP)', 'Order discount (EGP)',
  'Shipping charged (EGP)', 'Order total (EGP)', 'Payment status', 'Order status',
  'Return restocked at', 'Line ID', 'Synced at',
];
const KHT_INVENTORY_HEADERS = [
  'Website SKU', 'Product', 'Size', 'Color', 'Website stock', 'Price (EGP)',
  'Active', 'Updated at', 'Stock note', 'Synced at',
];

function khtSafeText(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function khtReplaceTab(spreadsheet, name, headers, rows) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const previousRows = Math.max(0, sheet.getLastRow() - 1);
  if (sheet.getMaxRows() < rows.length + 1) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rows.length + 1 - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setBackground('#111111').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  if (previousRows > rows.length) {
    sheet.getRange(rows.length + 2, 1, previousRows - rows.length, headers.length).clearContent();
  }
}

function syncKhtWebsite() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet || spreadsheet.getId() !== KHT_SPREADSHEET_ID) {
      throw new Error('Run this script from the KHT Brand Management workbook.');
    }
    const token = PropertiesService.getScriptProperties().getProperty('KHT_SYNC_TOKEN');
    if (!token) throw new Error('Set KHT_SYNC_TOKEN in Apps Script project settings first.');

    const orders = [];
    let inventory = [];
    let cursor = 0;
    for (let page = 0; page < 1000; page++) {
      const response = UrlFetchApp.fetch(KHT_EXPORT_URL + '?cursor=' + cursor, {
        method: 'get',
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
      });
      if (response.getResponseCode() !== 200) {
        throw new Error('KHT export failed with HTTP ' + response.getResponseCode());
      }
      const result = JSON.parse(response.getContentText());
      orders.push(...result.orders);
      if (cursor === 0) inventory = result.inventory;
      if (result.nextCursor == null) break;
      cursor = result.nextCursor;
      if (page === 999) throw new Error('KHT export exceeded the safe page limit.');
    }

    const syncedAt = new Date().toISOString();
    const seenOrders = new Set();
    const orderRows = orders.map((line) => {
      const firstLine = !seenOrders.has(line.number);
      seenOrders.add(line.number);
      return [
        khtSafeText(line.number), line.createdAt, khtSafeText(line.source),
        khtSafeText(line.sku), khtSafeText(line.productName), khtSafeText(line.variant),
        line.quantity, line.unitPrice, line.lineTotal,
        firstLine ? line.discount : '', firstLine ? line.shipping : '',
        firstLine ? line.total : '', khtSafeText(line.paymentStatus),
        khtSafeText(line.orderStatus), line.returnedRestockedAt || '',
        khtSafeText(line.lineId), syncedAt,
      ];
    });
    const inventoryRows = inventory.map((item) => [
      khtSafeText(item.sku), khtSafeText(item.productName), khtSafeText(item.size),
      khtSafeText(item.color), item.stock, item.unitPrice,
      item.active ? 'Yes' : 'No', item.updatedAt,
      item.sku.includes('-SET-')
        ? 'The website currently tracks set stock separately; a set physically uses a hoodie and pants.'
        : '',
      syncedAt,
    ]);
    khtReplaceTab(spreadsheet, 'Website Orders', KHT_ORDER_HEADERS, orderRows);
    khtReplaceTab(spreadsheet, 'Website Inventory', KHT_INVENTORY_HEADERS, inventoryRows);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function installKhtHourlySync() {
  const installed = ScriptApp.getProjectTriggers().some(
    (trigger) => trigger.getHandlerFunction() === 'syncKhtWebsite',
  );
  if (!installed) ScriptApp.newTrigger('syncKhtWebsite').timeBased().everyHours(1).create();
  syncKhtWebsite();
}
