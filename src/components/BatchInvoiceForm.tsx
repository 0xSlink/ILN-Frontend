'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import {
  validateInvoiceForm,
  type InvoiceFormValues,
  getMinimumDueDate,
  formatAmountFromUnits,
  parseAmountToUnits,
} from '@/utils/invoiceSubmission';
import { submitInvoicesBatch } from '@/utils/soroban';

const MAX_BATCH_SIZE = 50;

export interface BatchInvoiceRow extends InvoiceFormValues {
  id: string;
  errors?: Partial<Record<keyof InvoiceFormValues, string>>;
}

interface BatchInvoiceFormProps {
  onSuccess: (results: { successful: number; failed: number }) => void;
}

type InputMode = 'csv' | 'form';

const CSV_TEMPLATE = `payer,amount,token,discount_rate,due_date
GABC123EXAMPLE456DEF789GHI012JKL345MNO678PQR901STU234VWX567YZ,1000.00,USDC,3.50,2024-12-31
GDEF456EXAMPLE789ABC012GHI345JKL678MNO901PQR234STU567VWX890YZ,2500.50,EURC,4.25,2025-01-15`;

export default function BatchInvoiceForm({ onSuccess }: BatchInvoiceFormProps) {
  const { address, signTx } = useWallet();
  const { addToast, updateToast } = useToast();
  const { tokens, tokenMap, defaultToken } = useApprovedTokens();

  const [inputMode, setInputMode] = useState<InputMode>('csv');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<BatchInvoiceRow[]>([]);
  const [formRows, setFormRows] = useState<BatchInvoiceRow[]>([
    {
      id: '1',
      payer: '',
      amount: '',
      dueDate: getMinimumDueDate(),
      discountRate: '3.00',
      tokenId: defaultToken?.contractId || '',
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResults, setSubmissionResults] = useState<
    Array<{ id: string; success: boolean; error?: string }>
  >([]);

  const currentRows = inputMode === 'csv' ? csvData : formRows;

  const getTokenIdFromSymbol = useCallback(
    (symbol: string): string => {
      const token = Array.from(tokenMap.values()).find((t) => t.symbol === symbol.toUpperCase());
      return token?.contractId || defaultToken?.contractId || '';
    },
    [tokenMap, defaultToken]
  );

  const handleCsvUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setCsvFile(file);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            addToast({
              type: 'error',
              title: 'CSV Parse Error',
              message: results.errors[0].message,
            });
            return;
          }

          const rows: BatchInvoiceRow[] = results.data
            .slice(0, MAX_BATCH_SIZE)
            .map((row: any, index) => ({
              id: `csv-${index + 1}`,
              payer: row.payer || '',
              amount: row.amount || '',
              tokenId: getTokenIdFromSymbol(row.token || 'USDC'),
              discountRate: row.discount_rate || '3.00',
              dueDate: row.due_date || getMinimumDueDate(),
            }));

          setCsvData(rows);

          if (results.data.length > MAX_BATCH_SIZE) {
            addToast({
              type: 'warning',
              title: 'Rows Truncated',
              message: `Only the first ${MAX_BATCH_SIZE} rows were loaded.`,
            });
          }
        },
        error: (error) => {
          addToast({
            type: 'error',
            title: 'CSV Upload Failed',
            message: error.message,
          });
        },
      });
    },
    [addToast, defaultToken, getTokenIdFromSymbol]
  );

  const addFormRow = () => {
    if (formRows.length >= MAX_BATCH_SIZE) {
      addToast({
        type: 'error',
        title: 'Maximum Rows Reached',
        message: `You can only submit up to ${MAX_BATCH_SIZE} invoices at once.`,
      });
      return;
    }

    const newRow: BatchInvoiceRow = {
      id: `form-${formRows.length + 1}`,
      payer: '',
      amount: '',
      dueDate: getMinimumDueDate(),
      discountRate: '3.00',
      tokenId: defaultToken?.contractId || '',
    };
    setFormRows([...formRows, newRow]);
  };

  const removeFormRow = (id: string) => {
    if (formRows.length <= 1) return;
    setFormRows(formRows.filter((row) => row.id !== id));
  };

  const updateFormRow = (id: string, field: keyof InvoiceFormValues, value: string) => {
    setFormRows(
      formRows.map((row) => (row.id === id ? { ...row, [field]: value, errors: undefined } : row))
    );
  };

  const validateAllRows = (): BatchInvoiceRow[] => {
    return currentRows.map((row) => {
      const errors = validateInvoiceForm(
        row,
        true,
        tokenMap.get(row.tokenId)?.decimals || 7,
        tokenMap.get(row.tokenId)?.symbol || 'USDC'
      );
      return { ...row, errors };
    });
  };

  const validatedRows = useMemo(() => validateAllRows(), [currentRows, tokenMap]);
  const hasErrors = validatedRows.some((row) => row.errors && Object.keys(row.errors).length > 0);
  const totalAmount = useMemo(() => {
    return validatedRows.reduce((sum, row) => {
      if (row.errors && Object.keys(row.errors).length > 0) return sum;
      const amount = parseAmountToUnits(row.amount, tokenMap.get(row.tokenId)?.decimals || 7);
      return sum + (amount || 0n);
    }, 0n);
  }, [validatedRows, tokenMap]);

  const handleSubmit = async () => {
    if (hasErrors || currentRows.length === 0) return;

    setIsSubmitting(true);
    const toastId = addToast({
      type: 'pending',
      title: 'Submitting Batch Invoices',
      message: `Processing ${currentRows.length} invoices...`,
    });

    try {
      const results = await submitInvoicesBatch(address!, currentRows, signTx);
      setSubmissionResults(results);

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      updateToast(toastId, {
        type: successful === results.length ? 'success' : 'warning',
        title: 'Batch Submission Complete',
        message: `${successful} successful, ${failed} failed`,
      });

      onSuccess({ successful, failed });
    } catch (error) {
      updateToast(toastId, {
        type: 'error',
        title: 'Batch Submission Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice-batch-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden border border-outline-variant/10">
      {/* Header */}
      <div className="p-6 border-b border-surface-dim">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Batch Invoice Submission</h2>
          <div className="flex bg-surface-container-low p-1 rounded-xl">
            <button
              onClick={() => setInputMode('csv')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                inputMode === 'csv'
                  ? 'bg-primary text-surface-container-lowest shadow-md'
                  : 'text-on-surface-variant hover:bg-surface-variant/30'
              }`}
            >
              CSV Upload
            </button>
            <button
              onClick={() => setInputMode('form')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                inputMode === 'form'
                  ? 'bg-primary text-surface-container-lowest shadow-md'
                  : 'text-on-surface-variant hover:bg-surface-variant/30'
              }`}
            >
              Dynamic Form
            </button>
          </div>
        </div>

        {/* Summary */}
        {currentRows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-surface-container-low rounded-xl">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{currentRows.length}</div>
              <div className="text-sm text-on-surface-variant">Total Invoices</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatAmountFromUnits(totalAmount, 7)}
              </div>
              <div className="text-sm text-on-surface-variant">Total Amount</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatAmountFromUnits((totalAmount * 300n) / 10000n, 7)}
              </div>
              <div className="text-sm text-on-surface-variant">Est. Fees (3%)</div>
            </div>
          </div>
        )}
      </div>

      {/* CSV Upload Mode */}
      {inputMode === 'csv' && (
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">CSV Upload</h3>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download Template
              </button>
            </div>

            <div className="border-2 border-dashed border-outline-variant/30 rounded-xl p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-4">
                  upload_file
                </span>
                <p className="font-medium text-on-surface mb-2">Click to upload CSV file</p>
                <p className="text-sm text-on-surface-variant">
                  Maximum {MAX_BATCH_SIZE} invoices per batch
                </p>
              </label>
            </div>

            {csvFile && (
              <div className="mt-4 p-3 bg-surface-container-low rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600">check_circle</span>
                  <span className="font-medium">{csvFile.name}</span>
                  <span className="text-sm text-on-surface-variant">
                    ({csvData.length} rows loaded)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Form Mode */}
      {inputMode === 'form' && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Dynamic Form Entry</h3>
            <button
              onClick={addFormRow}
              disabled={formRows.length >= MAX_BATCH_SIZE}
              className="flex items-center gap-2 bg-primary text-surface-container-lowest px-4 py-2 rounded-lg font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Row
            </button>
          </div>
        </div>
      )}

      {/* Invoice Rows Table */}
      {currentRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-container-low border-b border-surface-dim">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-on-surface-variant">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-on-surface-variant">
                  Payer
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-on-surface-variant">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-on-surface-variant">
                  Token
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-on-surface-variant">
                  Discount %
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-on-surface-variant">
                  Due Date
                </th>
                {inputMode === 'form' && (
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-on-surface-variant">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim">
              {validatedRows.map((row, index) => (
                <BatchInvoiceRow
                  key={row.id}
                  row={row}
                  index={index}
                  isEditable={inputMode === 'form'}
                  tokens={tokens}
                  onUpdate={updateFormRow}
                  onRemove={removeFormRow}
                  canRemove={formRows.length > 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submit Button */}
      {currentRows.length > 0 && (
        <div className="p-6 border-t border-surface-dim bg-surface-container-low/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-on-surface-variant">
              {hasErrors ? (
                <span className="text-red-600 font-medium">
                  Please fix validation errors before submitting
                </span>
              ) : (
                <span>
                  Ready to submit {currentRows.length} invoice{currentRows.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={hasErrors || currentRows.length === 0 || isSubmitting}
              className="bg-primary text-surface-container-lowest px-6 py-3 rounded-lg font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">
                    refresh
                  </span>
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Submit Batch
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Submission Results */}
      {submissionResults.length > 0 && (
        <div className="p-6 border-t border-surface-dim">
          <h3 className="text-lg font-semibold mb-4">Submission Results</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {submissionResults.map((result, index) => (
              <div
                key={result.id}
                className={`p-3 rounded-lg flex items-center gap-3 ${
                  result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                <span className="material-symbols-outlined">
                  {result.success ? 'check_circle' : 'error'}
                </span>
                <div className="flex-1">
                  <div className="font-medium">
                    Invoice #{index + 1} - {result.success ? 'Success' : 'Failed'}
                  </div>
                  {result.error && <div className="text-sm opacity-80">{result.error}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface BatchInvoiceRowProps {
  row: BatchInvoiceRow;
  index: number;
  isEditable: boolean;
  tokens: Array<{ contractId: string; symbol: string; name: string }>;
  onUpdate: (id: string, field: keyof InvoiceFormValues, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

function BatchInvoiceRow({
  row,
  index,
  isEditable,
  tokens,
  onUpdate,
  onRemove,
  canRemove,
}: BatchInvoiceRowProps) {
  const hasErrors = row.errors && Object.keys(row.errors).length > 0;

  return (
    <tr className={hasErrors ? 'bg-red-50' : ''}>
      <td className="px-4 py-3 text-sm font-medium">{index + 1}</td>
      <td className="px-4 py-3">
        {isEditable ? (
          <input
            type="text"
            value={row.payer}
            onChange={(e) => onUpdate(row.id, 'payer', e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-lg ${
              row.errors?.payer ? 'border-red-300 bg-red-50' : 'border-outline-variant/30'
            }`}
            placeholder="Stellar address"
          />
        ) : (
          <span className="text-sm font-mono">{row.payer}</span>
        )}
        {row.errors?.payer && <div className="text-xs text-red-600 mt-1">{row.errors.payer}</div>}
      </td>
      <td className="px-4 py-3">
        {isEditable ? (
          <input
            type="number"
            step="0.01"
            value={row.amount}
            onChange={(e) => onUpdate(row.id, 'amount', e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-lg ${
              row.errors?.amount ? 'border-red-300 bg-red-50' : 'border-outline-variant/30'
            }`}
            placeholder="0.00"
          />
        ) : (
          <span className="text-sm font-bold">{row.amount}</span>
        )}
        {row.errors?.amount && <div className="text-xs text-red-600 mt-1">{row.errors.amount}</div>}
      </td>
      <td className="px-4 py-3">
        {isEditable ? (
          <select
            value={row.tokenId}
            onChange={(e) => onUpdate(row.id, 'tokenId', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-outline-variant/30 rounded-lg"
          >
            {tokens.map((token) => (
              <option key={token.contractId} value={token.contractId}>
                {token.symbol}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm">
            {tokens.find((t) => t.contractId === row.tokenId)?.symbol || 'USDC'}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditable ? (
          <input
            type="number"
            step="0.01"
            value={row.discountRate}
            onChange={(e) => onUpdate(row.id, 'discountRate', e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-lg ${
              row.errors?.discountRate ? 'border-red-300 bg-red-50' : 'border-outline-variant/30'
            }`}
            placeholder="3.00"
          />
        ) : (
          <span className="text-sm">{row.discountRate}%</span>
        )}
        {row.errors?.discountRate && (
          <div className="text-xs text-red-600 mt-1">{row.errors.discountRate}</div>
        )}
      </td>
      <td className="px-4 py-3">
        {isEditable ? (
          <input
            type="date"
            value={row.dueDate}
            onChange={(e) => onUpdate(row.id, 'dueDate', e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-lg ${
              row.errors?.dueDate ? 'border-red-300 bg-red-50' : 'border-outline-variant/30'
            }`}
          />
        ) : (
          <span className="text-sm">{row.dueDate}</span>
        )}
        {row.errors?.dueDate && (
          <div className="text-xs text-red-600 mt-1">{row.errors.dueDate}</div>
        )}
      </td>
      {isEditable && (
        <td className="px-4 py-3">
          <button
            onClick={() => onRemove(row.id)}
            disabled={!canRemove}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Remove row"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </td>
      )}
    </tr>
  );
}
