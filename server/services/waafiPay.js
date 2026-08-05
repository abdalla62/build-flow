const axios = require('axios');
const crypto = require('crypto');

/**
 * WaafiPay API_PURCHASE (mobile wallet).
 * Credentials come from env — never hardcode secrets.
 */
function getConfig() {
  const baseUrl = process.env.WAAFI_API_URL || 'https://api.waafipay.net/asm';
  const merchantUid = process.env.WAAFI_MERCHANT_UID;
  const apiUserId = process.env.WAAFI_API_USER_ID;
  const apiKey = process.env.WAAFI_API_KEY;
  const currency = process.env.WAAFI_CURRENCY || 'USD';

  if (!merchantUid || !apiUserId || !apiKey) {
    const err = new Error('WaafiPay is not configured. Set WAAFI_MERCHANT_UID, WAAFI_API_USER_ID, and WAAFI_API_KEY in server/.env');
    err.statusCode = 503;
    throw err;
  }

  return { baseUrl, merchantUid, apiUserId, apiKey, currency };
}

function waafiTimestamp() {
  const d = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** Normalize Somali MSISDN to 252XXXXXXXXX (no +). */
function normalizeAccountNo(raw) {
  if (!raw) return '';
  let n = String(raw).replace(/[\s+\-]/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('0') && n.length === 10) n = `252${n.slice(1)}`;
  if (n.length === 9 && (n.startsWith('61') || n.startsWith('62') || n.startsWith('63') || n.startsWith('68') || n.startsWith('69'))) {
    n = `252${n}`;
  }
  return n;
}

/**
 * Charge payer mobile wallet via API_PURCHASE.
 * @returns {{ success: boolean, transactionId?: string, referenceId: string, raw: object, message: string }}
 */
async function purchase({ accountNo, amount, referenceId, invoiceId, description }) {
  const { baseUrl, merchantUid, apiUserId, apiKey, currency } = getConfig();
  const payer = normalizeAccountNo(accountNo);

  if (!/^252\d{9}$/.test(payer)) {
    const err = new Error('Invalid mobile account. Use format 2526XXXXXXXX (EVC/ZAAD).');
    err.statusCode = 400;
    throw err;
  }

  const ref = String(referenceId).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 50);
  const inv = String(invoiceId || referenceId).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 50);
  const amt = Number(Number(amount).toFixed(2));

  const payload = {
    schemaVersion: '1.0',
    requestId: crypto.randomUUID(),
    timestamp: waafiTimestamp(),
    channelName: 'WEB',
    serviceName: 'API_PURCHASE',
    serviceParams: {
      merchantUid,
      apiUserId,
      apiKey,
      paymentMethod: 'MWALLET_ACCOUNT',
      payerInfo: {
        accountNo: payer
      },
      transactionInfo: {
        referenceId: ref,
        invoiceId: inv,
        amount: amt,
        currency,
        description: (description || `Payment ${ref}`).slice(0, 255)
      }
    }
  };

  const { data } = await axios.post(baseUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000
  });

  const ok =
    data &&
    (data.responseCode === '2001' || data.responseCode === 2001) &&
    (String(data.errorCode) === '0' || data.errorCode === 0) &&
    (data.responseMsg === 'RCS_SUCCESS' || data.params?.state?.toUpperCase?.() === 'APPROVED');

  if (!ok) {
    const message = data?.responseMsg || data?.params?.description || 'WaafiPay payment failed';
    const err = new Error(message);
    err.statusCode = 400;
    err.waafi = data;
    throw err;
  }

  return {
    success: true,
    transactionId: data.params?.transactionId || data.params?.issuerTransactionId || ref,
    referenceId: data.params?.referenceId || ref,
    accountNo: payer,
    raw: data,
    message: data.responseMsg || 'RCS_SUCCESS'
  };
}

module.exports = {
  purchase,
  normalizeAccountNo,
  getConfig
};
