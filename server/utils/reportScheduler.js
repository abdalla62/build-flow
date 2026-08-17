const ReportSchedule = require('../models/ReportSchedule');
const {
  buildAdminEmailSummaries,
  reportPeriod
} = require('../controllers/report');
const { sendReportSummaryEmail } = require('./reportEmail');

function previousMonthPeriod() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 12 : m;
  const monthStr = `${prevY}-${String(prevM).padStart(2, '0')}`;
  return reportPeriod({ month: monthStr });
}

async function runScheduledReportEmail() {
  const schedule = await ReportSchedule.findOne({ key: 'default' });
  if (!schedule?.enabled || !schedule.recipientEmails?.length) return;

  const now = new Date();
  const todayUtc = now.getUTCDate();
  if (todayUtc !== schedule.dayOfMonth) return;

  const period = previousMonthPeriod();
  if (period.error) return;

  if (
    schedule.lastSentPeriod === period.label &&
    schedule.lastSentAt &&
    now.getTime() - new Date(schedule.lastSentAt).getTime() < 20 * 60 * 60 * 1000
  ) {
    return;
  }

  try {
    const summaries = await buildAdminEmailSummaries(
      period.start,
      period.end,
      period.label
    );
    await sendReportSummaryEmail({
      recipients: schedule.recipientEmails,
      period,
      summaries
    });
    schedule.lastSentAt = now;
    schedule.lastSentPeriod = period.label;
    await schedule.save();
    console.log(`Scheduled report email sent for ${period.label}`);
  } catch (err) {
    console.error(`Scheduled report email failed: ${err.message}`);
  }
}

function startReportScheduler() {
  const hourMs = 60 * 60 * 1000;
  setTimeout(() => {
    runScheduledReportEmail().catch(() => {});
  }, 30 * 1000);
  setInterval(() => {
    runScheduledReportEmail().catch(() => {});
  }, hourMs);
}

module.exports = { startReportScheduler, runScheduledReportEmail };
