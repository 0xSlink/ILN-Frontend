import type { Meta, StoryObj } from '@storybook/react-vite';
import I18nProvider from './I18nProvider';

const meta: Meta<typeof I18nProvider> = {
  title: 'Components/I18nProvider',
  component: I18nProvider,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div className="p-8 text-center">Content wrapped with i18n provider</div>,
  },
};
