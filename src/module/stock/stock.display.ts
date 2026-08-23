/**
 * How a stock batch is presented when someone is choosing what to sell.
 *
 * Sale forms used to label each option with its batch number. Batch numbers are
 * vendor lot codes (or generated ones like BATCH-20260812-P4-PR2-1) and mean
 * nothing to the person taking the order — they were asking "which of these is
 * the old one?", which is the actual question. So the label carries the date the
 * batch arrived instead, and the list is ordered oldest first.
 *
 * The batch number is still shown wherever a specific batch has to be
 * identified after the fact — invoice lines, the stock page, the purchase it
 * came from.
 */

type StockOption = {
  quantity: number;
  createdAt: Date | string;
  product?: { name: string } | null;
};

/** Over HTTP a Date arrives as a string, whatever the type says. */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatStockAddedOn(value: Date | string): string {
  return toDate(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Oldest batch first, so the stock that has been sitting longest is the first
 * thing offered. Ties break on quantity so the fuller batch leads.
 */
export function sortStockOldestFirst<T extends StockOption>(stocks: T[]): T[] {
  return [...stocks].sort((a, b) => {
    const byAge = toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime();
    if (byAge !== 0) return byAge;
    return b.quantity - a.quantity;
  });
}

/** e.g. "14.2 kg Domestic — added 12 Aug 2026 · 40 left" */
export function stockOptionLabel(stock: StockOption): string {
  const name = stock.product?.name ?? "Unknown product";
  return `${name} — added ${formatStockAddedOn(stock.createdAt)} · ${stock.quantity} left`;
}
