# KHT website to Google Sheets sync

The bound Apps Script in `integrations/kht-sheet-sync.gs` refreshes two tabs in
the KHT Brand Management workbook every hour:

- **Website Orders**: one row per order item, including website SKU, quantity,
  sale price, order and payment status. Order-level totals appear on the first
  item row only, so they are not double-counted.
- **Website Inventory**: current website SKU, variant, price and stock.

The export endpoint is read-only, uses a dedicated `SHEET_SYNC_TOKEN` Worker
secret, and omits customer names, contact details and addresses. The script
stores the same token as the `KHT_SYNC_TOKEN` Script Property. It runs with the
spreadsheet owner's Google authorization to read the endpoint and edit only
the spreadsheet. `installKhtHourlySync` creates one hourly trigger and runs the
first sync; `syncKhtWebsite` can be run manually.

The existing `Daily Sales`, `Inventory`, costing and accounting formulas are
unchanged. Their SKUs and historical opening balances differ from the website.
In particular, the spreadsheet treats a set as one hoodie plus one pair of
pants, whereas the website currently tracks set stock independently. Do not
combine the new tabs with accounting or reconcile stock until the opening
balances and bundle stock behavior are corrected. The stock discrepancy is
flagged on each set row in **Website Inventory**.

The script replaces data only in the two `Website` tabs. It holds a lock to
prevent overlapping runs, escapes formula-leading text, and leaves the prior
data untouched if the export request fails. A successful run records its UTC
timestamp in the last column. Check Apps Script **Executions** for failures.
