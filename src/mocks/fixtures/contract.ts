import { TESTNET_EURC_TOKEN_ID, TESTNET_USDC_TOKEN_ID, TESTNET_XLM_TOKEN_ID } from '@/constants';

// Addresses below are valid 56-char strkeys (deterministic placeholders) so fixtures
// parse through StrKey/Address the same way live testnet responses do.
export const contractReadFixtures = {
  invoiceCount: 3,
  invoices: [
    {
      id: 1,
      status: 'Pending',
      freelancer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      payer: 'GBBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEFZSP',
      amount: '125000000',
      amount_paid: '0',
      due_date: '1893456000',
      discount_rate: 250,
      token: TESTNET_USDC_TOKEN_ID,
    },
    {
      id: 2,
      status: 'Funded',
      freelancer: 'GBBUGQ2DINBUGQ2DINBUGQ2DINBUGQ2DINBUGQ2DINBUGQ2DINBUGWKN',
      payer: 'GBCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIZCA',
      funder: 'GBCUKRKFIVCUKRKFIVCUKRKFIVCUKRKFIVCUKRKFIVCUKRKFIVCULW2C',
      amount: '250000000',
      amount_paid: '0',
      due_date: '1896048000',
      discount_rate: 320,
      funded_at: '1764547200',
      token: TESTNET_EURC_TOKEN_ID,
    },
    {
      id: 3,
      status: 'Disputed',
      freelancer: 'GBDEMRSGIZDEMRSGIZDEMRSGIZDEMRSGIZDEMRSGIZDEMRSGIZDEMGSF',
      payer: 'GBDUOR2HI5DUOR2HI5DUOR2HI5DUOR2HI5DUOR2HI5DUOR2HI5DUPJKH',
      funder: 'GBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQYC7',
      amount: '500000000',
      amount_paid: '0',
      due_date: '1898640000',
      discount_rate: 400,
      funded_at: '1764633600',
      token: TESTNET_XLM_TOKEN_ID,
    },
  ],
  tokenIds: [TESTNET_USDC_TOKEN_ID, TESTNET_EURC_TOKEN_ID, TESTNET_XLM_TOKEN_ID],
  tokenMetadata: {
    [TESTNET_USDC_TOKEN_ID]: { name: 'USD Coin', symbol: 'USDC', decimals: 7 },
    [TESTNET_EURC_TOKEN_ID]: { name: 'Euro Coin', symbol: 'EURC', decimals: 7 },
    [TESTNET_XLM_TOKEN_ID]: { name: 'Stellar Lumens', symbol: 'XLM', decimals: 7 },
  },
  balances: {
    [TESTNET_USDC_TOKEN_ID]: '1000000000',
    [TESTNET_EURC_TOKEN_ID]: '800000000',
    [TESTNET_XLM_TOKEN_ID]: '2500000000',
  },
  payerScore: {
    score: 92,
    settled_on_time: 14,
    defaults: 1,
  },
};
