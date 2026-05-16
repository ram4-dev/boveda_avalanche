#!/usr/bin/env node

const args = process.argv.slice(2);
const baseUrl = parseBaseUrl(args);

await assertDemoRuntime(baseUrl);
const resetResult = await requestJson(baseUrl, '/demo/reset', { method: 'POST' });

if (!resetResult.ok) {
  throw new Error(`Reset failed with status ${resetResult.status}`);
}

const evidence = resetResult.data;
if (evidence?.mode !== 'demo' || evidence?.evidenceSource !== 'demo-simulated') {
  throw new Error('Reset response is missing demo evidence metadata');
}

const loanResult = await requestJson(baseUrl, '/loans/loan-web3-001');
if (!loanResult.ok || loanResult.data?.currentMetrics?.outstandingPrincipal !== '150000') {
  throw new Error('Reset verification failed: expected loan-web3-001 outstandingPrincipal=150000');
}

const eventsResult = await requestJson(baseUrl, '/events?loanId=loan-web3-001');
if (!eventsResult.ok) {
  throw new Error(`Reset verification failed: events request status ${eventsResult.status}`);
}

const eventTypes = (eventsResult.data?.events ?? []).map((event) => event.eventType);
const staleTypes = eventTypes.filter((eventType) => eventType === 'InstallmentPaid' || eventType === 'Liquidated');
if (!eventTypes.includes('LoanCreated') || staleTypes.length > 0) {
  throw new Error(`Reset verification failed: expected baseline seed events without payment/liquidation evidence, got [${eventTypes.join(', ')}]`);
}

console.log(`Demo reset verified at ${evidence.resetAt} (${evidence.seedSourcePath}, loans=${evidence.loanCount}, events=${evidence.eventCount})`);

async function assertDemoRuntime(baseUrl) {
  const runtime = await requestJson(baseUrl, '/runtime');
  if (!runtime.ok) {
    throw new Error(`Runtime check failed with status ${runtime.status}`);
  }

  if (runtime.data?.mode !== 'demo') {
    throw new Error(`Refusing to reset non-demo runtime mode: ${runtime.data?.mode ?? 'unknown'}`);
  }
}

async function requestJson(baseUrl, path, init = {}) {
  const headers = init.body === undefined
    ? (init.headers ?? {})
    : { 'content-type': 'application/json', ...(init.headers ?? {}) };
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { ok: response.ok, status: response.status, data };
}

function parseBaseUrl(args) {
  const baseUrlIndex = args.findIndex((arg) => arg === '--base-url');
  const candidate = baseUrlIndex >= 0 ? args[baseUrlIndex + 1] : null;
  const baseUrl = candidate?.trim() || 'http://127.0.0.1:3000';

  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error('Invalid --base-url. Expected http:// or https:// URL.');
  }

  return baseUrl.replace(/\/$/, '');
}
