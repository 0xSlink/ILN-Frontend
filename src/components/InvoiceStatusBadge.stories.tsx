import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import InvoiceStatusBadge from './InvoiceStatusBadge';

/**
 * `InvoiceStatusBadge` renders an invoice's lifecycle status as a coloured pill.
 * It animates a brief fade/scale transition whenever the `status` prop changes,
 * and falls back to a neutral grey style for any unrecognised status.
 */
const meta: Meta<typeof InvoiceStatusBadge> = {
  title: 'Components/InvoiceStatusBadge',
  component: InvoiceStatusBadge,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      description: 'Invoice lifecycle status.',
      control: { type: 'select' },
      options: ['Pending', 'Funded', 'PartiallyFunded', 'Paid', 'Defaulted', 'Cancelled'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = { args: { status: 'Pending' } };
export const Funded: Story = { args: { status: 'Funded' } };
export const PartiallyFunded: Story = { args: { status: 'PartiallyFunded' } };
export const Paid: Story = { args: { status: 'Paid' } };
export const Defaulted: Story = { args: { status: 'Defaulted' } };
export const Cancelled: Story = { args: { status: 'Cancelled' } };

/** Edge state: an unrecognised status falls back to neutral grey styling. */
export const UnknownStatus: Story = {
  args: { status: 'Disputed' },
};

/** Every known status variant side by side. */
export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <InvoiceStatusBadge status="Pending" />
      <InvoiceStatusBadge status="Funded" />
      <InvoiceStatusBadge status="PartiallyFunded" />
      <InvoiceStatusBadge status="Paid" />
      <InvoiceStatusBadge status="Defaulted" />
      <InvoiceStatusBadge status="Cancelled" />
    </div>
  ),
};

/** Interactive demo of the animated transition that runs when status changes. */
export const StatusTransition: Story = {
  render: () => {
    const statuses = ['Pending', 'Funded', 'Paid', 'Defaulted', 'Cancelled'];
    const [index, setIndex] = useState(0);
    return (
      <div className="flex flex-col items-center gap-4">
        <InvoiceStatusBadge status={statuses[index]} />
        <button
          type="button"
          className="rounded-full border border-outline-variant px-3 py-1 text-xs font-bold"
          onClick={() => setIndex((i) => (i + 1) % statuses.length)}
        >
          Advance status
        </button>
      </div>
    );
  },
};

/** Mobile viewport rendering for responsive review. */
export const ResponsiveMobile: Story = {
  args: { status: 'Funded' },
  parameters: {
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '800px' } },
      },
      defaultViewport: 'mobile',
    },
  },
};

/** Dark-theme rendering of every status (Chromatic dark variant). */
export const DarkTheme: Story = {
  globals: { theme: 'dark' },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <InvoiceStatusBadge status="Pending" />
      <InvoiceStatusBadge status="Funded" />
      <InvoiceStatusBadge status="PartiallyFunded" />
      <InvoiceStatusBadge status="Paid" />
      <InvoiceStatusBadge status="Defaulted" />
      <InvoiceStatusBadge status="Cancelled" />
    </div>
  ),
};
