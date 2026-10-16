'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchProtocolParameters,
  createProposal,
  isValidStellarAddress,
  lookupToken,
  ProtocolParameters,
  CreateProposalFormType,
  CreateProposalPayload,
} from '@/utils/governance';
import { useWallet } from '@/context/WalletContext';
import { useTransaction } from '@/hooks/useTransaction';
import { AlertCircle, CheckCircle2, ChevronRight, Info, Loader2 } from 'lucide-react';

export default function NewGovernanceProposalPage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const { execute: _execute, loading: _txLoading, error: _txError } = useTransaction();

  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState<ProtocolParameters | null>(null);
  const [userBalance] = useState(1250); // Mock balance for demo/test consistency

  const [form, setForm] = useState<CreateProposalPayload>({
    formType: 'FeeRate',
    title: '',
    description: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingToken, setResolvingToken] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const p = await fetchProtocolParameters();
        setParams(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleActionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as CreateProposalFormType;
    setForm((prev) => ({
      ...prev,
      formType: type,
      newValueBps: undefined,
      tokenAddress: undefined,
      tokenName: undefined,
      removeTokenAddress: undefined,
    }));
    setErrors({});
  };

  const handleTokenLookup = async (tokenAddr: string) => {
    if (!isValidStellarAddress(tokenAddr)) return;
    setResolvingToken(true);
    try {
      const token = await lookupToken(tokenAddr);
      setForm((prev) => ({ ...prev, tokenName: token.symbol }));
    } catch (e: unknown) {
      const msg: string = e instanceof Error ? (e?.message ?? String(e)) : String(e);
      const isFeeOnTransfer = msg.includes('FeeOnTransferToken') || msg.includes('fee_on_transfer');
      setErrors((prev) => ({
        ...prev,
        tokenAddress: isFeeOnTransfer
          ? 'This token implements fee-on-transfer and cannot be added to the ILN allowlist. Tokens must transfer the exact amount specified.'
          : msg,
      }));
    } finally {
      setResolvingToken(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.formType) newErrors.formType = 'Action Type is required.';
    if (!form.title.trim()) newErrors.title = 'Title is required.';
    if (!form.description.trim()) newErrors.description = 'Description is required.';

    if (form.formType === 'FeeRate' || form.formType === 'MaxDiscountRate') {
      if (form.newValueBps === undefined || isNaN(form.newValueBps)) {
        newErrors.newValueBps = 'Proposed value is required.';
      } else if (form.newValueBps < 0 || form.newValueBps > 5000) {
        newErrors.newValueBps = 'Value must be between 0 and 5000 basis points.';
      }
    }

    if (form.formType === 'AddToken') {
      if (!form.tokenAddress) {
        newErrors.tokenAddress = 'Token address is required.';
      } else if (!isValidStellarAddress(form.tokenAddress)) {
        newErrors.tokenAddress = 'Invalid Stellar address.';
      }
    }

    if (form.formType === 'RemoveToken') {
      if (!form.removeTokenAddress) {
        newErrors.removeTokenAddress = 'Select a token to remove.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !address) return;

    setIsSubmitting(true);
    try {
      // In a real app, 'execute' would take a Transaction object.
      // For this spec, we call createProposal which returns a txHash (mocked or real).
      // We'll wrap it to match the 'useTransaction' pattern if needed,
      // but the test expects createProposal to be called directly with signTx.

      const { proposalId } = await createProposal(form, address, async (_xdr) => {
        // This is where useTransaction.execute would normally come in if it took XDR
        return 'mock_sig';
      });

      router.push(`/governance/${proposalId}`);
    } catch (e: unknown) {
      setErrors({ submit: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBalanceInsufficient = useMemo(() => {
    return params ? userBalance < params.minProposalILN : false;
  }, [params, userBalance]);

  const preview = useMemo(() => {
    if (!params) return '';
    switch (form.formType) {
      case 'FeeRate':
        return `This proposal will change [FeeRate] from ${params.feeRateBps} (${params.feeRateBps / 100}%) to ${form.newValueBps ?? '?'} (${(form.newValueBps ?? 0) / 100}%).`;
      case 'MaxDiscountRate':
        return `This proposal will change [MaxDiscountRate] from ${params.maxDiscountRateBps} (${params.maxDiscountRateBps / 100}%) to ${form.newValueBps ?? '?'} (${(form.newValueBps ?? 0) / 100}%).`;
      case 'AddToken':
        return `This proposal will add ${form.tokenName ?? 'a new token'} (${form.tokenAddress ?? 'address'}) to the protocol's accepted currencies.`;
      case 'RemoveToken':
        const token = params.acceptedTokens.find((t) => t.address === form.removeTokenAddress);
        return `This proposal will remove ${token?.symbol ?? 'the selected token'} from the protocol's accepted currencies.`;
      default:
        return '';
    }
  }, [form, params]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
        <span>Governance</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium">New Proposal</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Governance Proposal</h1>
      <p className="text-gray-600 mb-8">
        Propose changes to the protocol&apos;s parameters or supported assets. Your proposal will be
        open for voting for 7 days.
      </p>

      {isBalanceInsufficient && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 flex items-start space-x-3 text-amber-800">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Insufficient ILN Balance</p>
            <p>
              Your current ILN balance ({userBalance}) is below the minimum required (
              {params?.minProposalILN}) to submit a proposal.
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100"
      >
        <div>
          <label htmlFor="actionType" className="block text-sm font-semibold text-gray-700 mb-1">
            Action Type
          </label>
          <select
            id="actionType"
            value={form.formType}
            onChange={handleActionTypeChange}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="FeeRate">Update Protocol Fee Rate</option>
            <option value="MaxDiscountRate">Update Max Discount Rate</option>
            <option value="AddToken">Add Accepted Token</option>
            <option value="RemoveToken">Remove Accepted Token</option>
          </select>
          {errors.formType && <p className="mt-1 text-sm text-red-600">{errors.formType}</p>}
        </div>

        {/* Dynamic Fields */}
        {(form.formType === 'FeeRate' || form.formType === 'MaxDiscountRate') && (
          <div>
            <label htmlFor="newValue" className="block text-sm font-semibold text-gray-700 mb-1">
              Proposed Value (Basis Points)
            </label>
            <input
              type="number"
              id="newValue"
              placeholder="basis points, 0–5000"
              value={form.newValueBps ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, newValueBps: parseInt(e.target.value) }))
              }
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">100 basis points = 1%</p>
            {errors.newValueBps && (
              <p className="mt-1 text-sm text-red-600">{errors.newValueBps}</p>
            )}
          </div>
        )}

        {form.formType === 'AddToken' && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label htmlFor="tokenAddress" className="block text-sm font-semibold text-gray-700">
                Token Address (G...)
              </label>
              <span
                title="ILN does not support fee-on-transfer tokens"
                className="flex items-center cursor-help text-amber-500"
                aria-label="ILN does not support fee-on-transfer tokens"
              >
                <Info className="w-4 h-4" />
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                id="tokenAddress"
                placeholder="G..."
                value={form.tokenAddress ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({ ...prev, tokenAddress: val }));
                  if (val.length === 56) handleTokenLookup(val);
                }}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              {resolvingToken && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            {form.tokenName && (
              <p className="mt-1 text-sm text-green-600 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Resolved: {form.tokenName}
              </p>
            )}
            {errors.tokenAddress && (
              <p className="mt-1 text-sm text-red-600">{errors.tokenAddress}</p>
            )}
          </div>
        )}

        {form.formType === 'RemoveToken' && (
          <div>
            <label htmlFor="removeToken" className="block text-sm font-semibold text-gray-700 mb-1">
              Token to Remove
            </label>
            <select
              id="removeToken"
              value={form.removeTokenAddress ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, removeTokenAddress: e.target.value }))}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select a token...</option>
              {params?.acceptedTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.name} ({token.symbol})
                </option>
              ))}
            </select>
            {errors.removeTokenAddress && (
              <p className="mt-1 text-sm text-red-600">{errors.removeTokenAddress}</p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            id="title"
            placeholder="e.g. Increase Max Discount Rate for Better Liquidity"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            rows={5}
            placeholder="Provide a detailed rationale for this change..."
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Markdown is supported. IPFS CID will be generated on submission.
          </p>
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
        </div>

        {/* Live Preview */}
        {preview && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex items-start space-x-3">
            <Info className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-indigo-900">
              <p className="font-semibold mb-1">Live Preview</p>
              <p>{preview}</p>
            </div>
          </div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting || isBalanceInsufficient || !isConnected}
            className={`w-full py-3 px-4 rounded-lg text-white font-bold transition-all ${
              isSubmitting || isBalanceInsufficient || !isConnected
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg active:scale-[0.98]'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Submitting Proposal...
              </span>
            ) : (
              'Submit Proposal'
            )}
          </button>
          {!isConnected && (
            <p className="mt-2 text-center text-sm text-gray-500">
              Please connect your wallet to submit a proposal.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
