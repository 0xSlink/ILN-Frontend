import type { Meta, StoryObj } from '@storybook/react-vite';
import PageHeader from './PageHeader';
import React from 'react';

const meta: Meta<typeof PageHeader> = {
  title: 'Components/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: 'Dashboard',
  },
};

export const WithDescription: Story = {
  args: {
    title: 'Dashboard',
    description: 'Manage invoices, liquidity, and protocol activity.',
  },
};

export const WithActions: Story = {
  args: {
    title: 'Marketplace',
    actions: (
      <button className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm">
        Submit Invoice
      </button>
    ),
  },
};

export const WithBreadcrumbs: Story = {
  args: {
    title: 'Invoice Details',
    breadcrumbs: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'Invoice #42' },
    ],
  },
};

export const FullExample: Story = {
  args: {
    title: 'Invoice Details',
    description: 'Review invoice information and track payment status.',
    breadcrumbs: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'Invoice #42' },
    ],
    actions: (
      <div className="flex gap-2">
        <button className="px-4 py-2 border border-outline-variant/30 text-on-surface-variant rounded-xl font-bold text-sm">
          Edit
        </button>
        <button className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm">
          Fund Invoice
        </button>
      </div>
    ),
  },
};
