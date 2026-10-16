'use client';

import Link from 'next/link';
import { NETWORK_NAME, NFT_CONTRACT_ID, NEXT_PUBLIC_NFT_ENABLED } from '@/constants';
import { formatAddress } from '@/utils/format';
import { useInvoiceNft } from '@/hooks/useInvoiceNft';
import type { InvoiceNftState, InvoiceNftTransfer } from '@/lib/invoice-nft';

function getExplorerNetworkPath() {
  return NETWORK_NAME.toLowerCase();
}

function getContractUrl(contractId: string) {
  return `https://stellar.expert/explorer/${getExplorerNetworkPath()}/contract/${contractId}`;
}

function getTxUrl(txHash: string) {
  return `https://stellar.expert/explorer/${getExplorerNetworkPath()}/tx/${txHash}`;
}

function fallbackSvgDataUri(tokenId: bigint) {
  const seed = tokenId.toString().slice(-6).padStart(6, '0');
  const a = Number(seed.slice(0, 2));
  const b = Number(seed.slice(2, 4));
  const c = Number(seed.slice(4, 6));
  const hue1 = (a * 13) % 360;
  const hue2 = (b * 17 + 120) % 360;
  const hue3 = (c * 19 + 240) % 360;
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue1} 85% 55%)"/>
          <stop offset="55%" stop-color="hsl(${hue2} 85% 55%)"/>
          <stop offset="100%" stop-color="hsl(${hue3} 85% 55%)"/>
        </linearGradient>
        <filter id="blur">
          <feGaussianBlur stdDeviation="28"/>
        </filter>
      </defs>
      <rect width="640" height="640" rx="44" fill="url(#g)"/>
      <circle cx="170" cy="190" r="120" fill="rgba(255,255,255,0.25)" filter="url(#blur)"/>
      <circle cx="500" cy="470" r="160" fill="rgba(0,0,0,0.12)" filter="url(#blur)"/>
      <text x="50%" y="54%" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas" font-size="44" fill="rgba(255,255,255,0.92)">Invoice NFT</text>
      <text x="50%" y="62%" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas" font-size="22" fill="rgba(255,255,255,0.88)">Token #${tokenId.toString()}</text>
    </svg>
  `).replace(/%0A/g, '');
  return `data:image/svg+xml;charset=utf-8,${svg}`;
}

function renderTransferRow(transfer: InvoiceNftTransfer) {
  const when =
    typeof transfer.timestamp === 'number' ? new Date(transfer.timestamp).toLocaleString() : null;
  const label =
    transfer.from && transfer.to
      ? `${formatAddress(transfer.from)} → ${formatAddress(transfer.to)}`
      : transfer.to
        ? `To ${formatAddress(transfer.to)}`
        : transfer.from
          ? `From ${formatAddress(transfer.from)}`
          : 'Token activity';

  return (
    <li
      key={transfer.txHash}
      className="flex items-start justify-between gap-3 border-b border-outline-variant/10 py-3 last:border-b-0"
    >
      <div className="min-w-0">
        <p className="truncate font-mono text-sm text-on-surface">{label}</p>
        <p className="mt-1 text-xs text-on-surface-variant">{when ?? 'Unknown time'}</p>
      </div>
      <a
        href={getTxUrl(transfer.txHash)}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-sm font-bold text-primary hover:underline"
      >
        View tx
      </a>
    </li>
  );
}

function NftBody({
  invoiceId,
  invoiceStatus,
  walletAddress,
  invoiceFunder,
  state,
  onRetry,
}: {
  invoiceId: bigint;
  invoiceStatus: string;
  walletAddress: string | null;
  invoiceFunder?: string;
  state: InvoiceNftState;
  onRetry: () => void;
}) {
  if (state.status === 'none') return null;

  const imageUrl = state.metadata?.image ?? fallbackSvgDataUri(state.tokenId);
  const name = state.metadata?.name ?? `Invoice #${invoiceId.toString()} NFT`;
  const description =
    state.metadata?.description ?? 'Composability receipt for the invoice position.';

  const isPaid = invoiceStatus === 'Paid';
  const isBurned = state.status === 'burned';
  const burnPending = isPaid && state.status === 'minted' && !state.burnTxHash;

  const isLpReceipt =
    Boolean(walletAddress) &&
    ((invoiceFunder && walletAddress?.toLowerCase() === invoiceFunder.toLowerCase()) ||
      (state.currentHolder && walletAddress?.toLowerCase() === state.currentHolder.toLowerCase()));

  return (
    <section className="mt-8 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-xl">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full md:max-w-[260px]">
          <div className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={name} className="h-[260px] w-full object-cover" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-bold text-on-surface">{name}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{description}</p>
          </div>
          <div className="mt-4 flex gap-3">
            <a
              href={getContractUrl(NFT_CONTRACT_ID)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              View on Stellar
            </a>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Retry
            </button>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Invoice NFT
              </p>
              {isBurned ? (
                <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-600">
                  <span className="material-symbols-outlined text-[18px]">
                    local_fire_department
                  </span>
                  NFT Burned
                </p>
              ) : null}
              {burnPending ? (
                <p className="mt-2 text-sm text-on-surface-variant">
                  Invoice is paid, but burn transaction is not detected yet.
                </p>
              ) : null}
            </div>
            {isLpReceipt ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                <p className="font-bold">Your NFT claim receipt</p>
                <p className="mt-1 text-xs">
                  This NFT represents your claim on the invoice position.
                </p>
              </div>
            ) : null}
          </div>

          <dl className="mt-6 grid gap-4 text-sm">
            <DetailRow label="Token ID" value={state.tokenId.toString()} />
            <DetailRow
              label="Current Holder"
              value={state.currentHolder ? formatAddress(state.currentHolder) : 'Unknown'}
              href={state.currentHolder ? `/profile/${state.currentHolder}` : undefined}
              externalHref={
                state.currentHolder
                  ? `https://stellar.expert/explorer/${getExplorerNetworkPath()}/account/${state.currentHolder}`
                  : undefined
              }
            />
            <DetailRow
              label="Mint Date"
              value={
                typeof state.mintDate === 'number'
                  ? new Date(state.mintDate).toLocaleString()
                  : 'Unknown'
              }
            />
            {state.mintTxHash ? (
              <DetailRow
                label="Mint Tx"
                value={state.mintTxHash.slice(0, 10) + '…'}
                externalHref={getTxUrl(state.mintTxHash)}
              />
            ) : null}
            {state.burnTxHash ? (
              <DetailRow
                label="Burn Tx"
                value={state.burnTxHash.slice(0, 10) + '…'}
                externalHref={getTxUrl(state.burnTxHash)}
              />
            ) : null}
          </dl>

          <div className="mt-6">
            <h3 className="text-sm font-bold text-on-surface">Transfer History</h3>
            {state.transfers.length === 0 ? (
              <p className="mt-2 text-sm text-on-surface-variant">No transfer history found yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-outline-variant/10 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4">
                {state.transfers.map(renderTransferRow)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function InvoiceNftCard({
  invoiceId,
  invoiceStatus,
  walletAddress,
  invoiceFunder,
}: {
  invoiceId: bigint;
  invoiceStatus: string;
  walletAddress: string | null;
  invoiceFunder?: string;
}) {
  const isEnabled = NEXT_PUBLIC_NFT_ENABLED || process.env.NEXT_PUBLIC_NFT_ENABLED === 'true';
  const { state, loading, reload } = useInvoiceNft(invoiceId, isEnabled);

  if (!isEnabled) return null;

  if (loading && !state) {
    return (
      <section className="mt-8 animate-pulse rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-xl">
        <div className="h-4 w-40 rounded-full bg-surface-container-high" />
        <div className="mt-6 grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="h-[260px] rounded-2xl bg-surface-container-high" />
          <div className="space-y-3">
            <div className="h-10 rounded-2xl bg-surface-container-high" />
            <div className="h-10 rounded-2xl bg-surface-container-high" />
            <div className="h-10 rounded-2xl bg-surface-container-high" />
          </div>
        </div>
      </section>
    );
  }

  if (!state) return null;

  if (state.status === 'error') {
    return (
      <section className="mt-8 rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Invoice NFT</p>
        <p className="mt-2 text-sm text-error">Unable to load NFT right now.</p>
        <p className="mt-1 text-xs text-on-surface-variant">{state.error ?? 'Unknown error'}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Retry
        </button>
      </section>
    );
  }

  return (
    <NftBody
      invoiceId={invoiceId}
      invoiceStatus={invoiceStatus}
      walletAddress={walletAddress}
      invoiceFunder={invoiceFunder}
      state={state}
      onRetry={reload}
    />
  );
}

function DetailRow({
  label,
  value,
  href,
  externalHref,
}: {
  label: string;
  value: string;
  href?: string;
  externalHref?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-outline-variant/10 pb-3 last:border-b-0">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="flex items-center gap-3 font-mono text-sm">
        {href ? (
          <Link href={href} className="text-primary hover:underline">
            {value}
          </Link>
        ) : (
          <span className="text-on-surface">{value}</span>
        )}
        {externalHref ? (
          <a
            href={externalHref}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-primary hover:underline"
          >
            Stellar
          </a>
        ) : null}
      </dd>
    </div>
  );
}
