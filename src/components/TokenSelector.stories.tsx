import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import TokenSelector from './TokenSelector';

const meta: Meta<typeof TokenSelector> = {
  title: 'Components/TokenSelector',
  component: TokenSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockTokens = [
  { symbol: 'USDC', address: 'CUSDC123', decimals: 6 },
  { symbol: 'EURC', address: 'CEURC456', decimals: 6 },
  { symbol: 'XLM', address: 'native', decimals: 7 },
];

export const Default: Story = {
  args: {
    tokens: mockTokens,
    selectedToken: mockTokens[0],
    onTokenChange: fn((token) => `Selected token: ${token}`),
  },
};

export const WithAmount: Story = {
  args: {
    tokens: mockTokens,
    selectedToken: mockTokens[0],
    amount: '1000',
    onTokenChange: fn((token) => `Selected token: ${token}`),
    onAmountChange: fn((amount) => `Amount: ${amount}`),
  },
};

export const Disabled: Story = {
  args: {
    tokens: mockTokens,
    selectedToken: mockTokens[0],
    disabled: true,
  },
};

export const WithError: Story = {
  args: {
    tokens: mockTokens,
    selectedToken: mockTokens[0],
    amount: 'invalid',
    error: 'Please enter a valid amount',
    onTokenChange: fn((token) => `Selected token: ${token}`),
    onAmountChange: fn((amount) => `Amount: ${amount}`),
  },
};

export const Loading: Story = {
  args: {
    tokens: [],
    loading: true,
  },
};
