const sendEmail = require('./email');

function metricRow(title, count, detail) {
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">${title}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${count ?? 0}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;">${detail || '—'}</td>
  </tr>`;
}

function buildReportEmailHtml(period, summaries) {
  const rows = [
    metricRow(
      'Material Requests',
      summaries.materialRequests?.count,
      `Est. cost: $${summaries.materialRequests?.summary?.totalEstCost ?? 0}`
    ),
    metricRow(
      'Project Budget',
      summaries.projectBudget?.count,
      `Remaining: $${summaries.projectBudget?.summary?.totalRemaining ?? 0}`
    ),
    metricRow(
      'Inventory Ledger',
      summaries.inventoryLedger?.count,
      `In: ${summaries.inventoryLedger?.summary?.totalQtyIn ?? 0} / Out: ${summaries.inventoryLedger?.summary?.totalQtyOut ?? 0}`
    ),
    metricRow(
      'Supplier Declines',
      summaries.supplierDecline?.count,
      `${summaries.supplierDecline?.summary?.supplierCount ?? 0} suppliers`
    ),
    metricRow(
      'Tax Summary',
      summaries.taxSummary?.count,
      `Total tax: $${summaries.taxSummary?.summary?.totalTax ?? 0}`
    ),
    metricRow(
      'Damaged & Missing',
      summaries.damagedMissing?.count,
      `${summaries.damagedMissing?.summary?.damagedCount ?? 0} damaged / ${summaries.damagedMissing?.summary?.missingCount ?? 0} missing`
    )
  ].join('');

  return `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
    <h2 style="margin:0 0 8px;color:#0f766e;">BuildFlow — Report Summary</h2>
    <p style="margin:0 0 20px;color:#64748b;">Period: <strong>${period.label}</strong></p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f1f5f9;text-align:left;">
          <th style="padding:8px 12px;">Report</th>
          <th style="padding:8px 12px;text-align:right;">Rows</th>
          <th style="padding:8px 12px;">Highlight</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
      Open BuildFlow for full PDF/Excel exports and charts.
    </p>
  </div>
</body>
</html>`;
}

async function sendReportSummaryEmail({ recipients, period, summaries }) {
  const html = buildReportEmailHtml(period, summaries);
  const text = `BuildFlow report summary for ${period.label}. Open the app for full exports.`;
  const subject = `BuildFlow Reports — ${period.label}`;

  for (const email of recipients) {
    await sendEmail({
      email,
      subject,
      message: text,
      html
    });
  }
}

module.exports = { sendReportSummaryEmail, buildReportEmailHtml };
