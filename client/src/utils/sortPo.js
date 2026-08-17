/** Latest PO number first (PO-2026-00005 above 00004). Empty numbers go last. */
export function sortByPoNumberDesc(items, getNumber = (item) => item?.purchaseOrderNumber) {
  return [...(items || [])].sort((a, b) => {
    const an = String(getNumber(a) || '').trim();
    const bn = String(getNumber(b) || '').trim();
    if (!an && !bn) return 0;
    if (!an) return 1;
    if (!bn) return -1;
    return bn.localeCompare(an, undefined, { numeric: true, sensitivity: 'base' });
  });
}
