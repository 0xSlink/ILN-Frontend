import { http, HttpResponse } from 'msw';

/**
 * Lightweight fault-injection harness for contract (Soroban RPC) and Horizon
 * call sites (Issue #758).
 *
 * These are MSW handler factories. Call `server.use(...)` with one of them in a
 * test to replace the corresponding happy-path handler for that test only; the
 * shared `vitest.setup.ts` calls `server.resetHandlers()` after each test, so
 * faults never leak between tests.
 *
 * Supported fault classes:
 *  - HTTP 5xx (server errors)          → `injectRpcFault` / `injectHorizonFault`
 *  - Timeout / unresponsive endpoint   → `injectRpcTimeout`
 *  - Malformed (non-JSON) responses    → `injectRpcMalformed` / `injectHorizonMalformed`
 *  - Network-level errors              → `injectRpcNetworkError`
 */

export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org';

const tinyDelay = () => new Promise((resolve) => setTimeout(resolve, 10));

/** RPC returns the given HTTP status (typically a 5xx). */
export function injectRpcFault(status: number, body?: unknown) {
  return http.post(SOROBAN_RPC_URL, async () => {
    await tinyDelay();
    return HttpResponse.json(body ?? { error: `Simulated RPC fault (HTTP ${status})` }, { status });
  });
}

/** RPC never responds until `delayMs` elapses, simulating an unresponsive endpoint. */
export function injectRpcTimeout(delayMs: number) {
  return http.post(SOROBAN_RPC_URL, async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return HttpResponse.json({ status: 'healthy' });
  });
}

/** RPC responds with a 200 but a non-JSON body the SDK cannot parse. */
export function injectRpcMalformed() {
  return http.post(SOROBAN_RPC_URL, async () => {
    await tinyDelay();
    return new HttpResponse('<html>not json</html>', { status: 200 });
  });
}

/** RPC endpoint is unreachable at the network level (e.g. dropped connection). */
export function injectRpcNetworkError() {
  return http.post(SOROBAN_RPC_URL, () => HttpResponse.error());
}

/** Horizon /accounts/{id} returns the given HTTP status. */
export function injectHorizonFault(status: number) {
  return http.get(`${HORIZON_TESTNET_URL}/accounts/:accountId`, async () => {
    await tinyDelay();
    return new HttpResponse(null, { status });
  });
}

/** Horizon /accounts/{id} responds 200 with a non-JSON body. */
export function injectHorizonMalformed() {
  return http.get(`${HORIZON_TESTNET_URL}/accounts/:accountId`, async () => {
    await tinyDelay();
    return new HttpResponse('<html>not json</html>', { status: 200 });
  });
}

/** Horizon /transactions (governance event reads) returns the given HTTP status. */
export function injectHorizonTransactionsFault(status: number) {
  return http.get(`${HORIZON_TESTNET_URL}/transactions`, async () => {
    await tinyDelay();
    return new HttpResponse(null, { status });
  });
}
