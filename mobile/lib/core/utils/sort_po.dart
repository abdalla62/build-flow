/// Latest PO number first (PO-2026-00005 above 00004). Empty numbers go last.
List<Map<String, dynamic>> sortByPoNumberDesc(
  List<Map<String, dynamic>> items, {
  String Function(Map<String, dynamic> item)? getNumber,
}) {
  final copy = List<Map<String, dynamic>>.from(items);
  copy.sort((a, b) {
    final an = (getNumber != null ? getNumber(a) : a['purchaseOrderNumber']?.toString() ?? '')
        .trim();
    final bn = (getNumber != null ? getNumber(b) : b['purchaseOrderNumber']?.toString() ?? '')
        .trim();
    if (an.isEmpty && bn.isEmpty) return 0;
    if (an.isEmpty) return 1;
    if (bn.isEmpty) return -1;
    return _numericCompareDesc(an, bn);
  });
  return copy;
}

int _numericCompareDesc(String a, String b) {
  final aParts = _splitNumeric(a);
  final bParts = _splitNumeric(b);
  final n = aParts.length < bParts.length ? aParts.length : bParts.length;
  for (var i = 0; i < n; i++) {
    final ap = aParts[i];
    final bp = bParts[i];
    final aNum = int.tryParse(ap);
    final bNum = int.tryParse(bp);
    final c = (aNum != null && bNum != null) ? bNum.compareTo(aNum) : bp.compareTo(ap);
    if (c != 0) return c;
  }
  return bParts.length.compareTo(aParts.length);
}

List<String> _splitNumeric(String value) {
  return value.split(RegExp(r'(?<=\D)(?=\d)|(?<=\d)(?=\D)'));
}
