import type { Meta, StoryObj } from '@storybook/react-vite';
import InvoicePdfButton from './InvoicePdfButton';

const meta: Meta<typeof InvoicePdfButton> = {
  title: 'Components/InvoicePdfButton',
  component: InvoicePdfButton,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockInvoice = {
  id: 42n,
  amount: 1_000_000_000n,
  status: 'Paid',
  payer: 'GABC12345678901234567890123456789012345678901234567890123456',
  freelancer: 'GDEF4567890123456789012345678901234567890123456789012345678',
  discount_rate: 300,
  due_date: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
  token: 'USDC',
} as any;

const baseData = {
  tokenSymbol: 'USDC',
  amountFormatted: '1,000.00',
  dueDateFormatted: 'Jul 26, 2026',
};

/** Default — opens the modal so custom fields and preview can be exercised. */
export const Default: Story = {
  args: {
    invoice: mockInvoice,
    data: baseData,
    baseUrl: 'https://app.iln.finance',
  },
};

/** Pre-filled — shows the modal would embed non-empty custom field values in the PDF. */
export const WithCustomFields: Story = {
  args: {
    invoice: mockInvoice,
    data: {
      ...baseData,
      notes: 'Please reference invoice #42 in your payment.',
      termsAndConditions: 'Payment is due within 30 days. Late fees apply.',
      paymentInstructions:
        'GDEF4567890123456789012345678901234567890123456789012345678 (Stellar USDC)',
    },
    baseUrl: 'https://app.iln.finance',
  },
};
