import type { Preview } from '@storybook/react';
import { createElement } from 'react';
import '../app/globals.css';

const THEME_BG = {
  light: { background: '#fff8f3', color: '#1a1a1a' },
  dark: { background: '#1a1a1a', color: '#ffffff' },
} as const;

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#fff8f3',
        },
        {
          name: 'dark',
          value: '#1a1a1a',
        },
      ],
    },
    a11y: {
      test: 'todo',
    },
    chromatic: {
      modes: [
        { name: 'light', background: '#fff8f3', theme: 'light' },
        { name: 'dark', background: '#1a1a1a', theme: 'dark' },
      ],
    },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  // Apply the active theme to a wrapper element. Tailwind v4 keys dark mode off a
  // `.dark` ancestor, so toggling the `dark` class (and a matching background)
  // here makes every story render correctly in both themes — including
  // per-story `globals: { theme: 'dark' }` variants used for Chromatic review.
  decorators: [
    (Story, context) => {
      const theme: 'light' | 'dark' = context.globals.theme === 'dark' ? 'dark' : 'light';
      return createElement(
        'div',
        {
          className: theme === 'dark' ? 'dark' : undefined,
          'data-theme': theme,
          style: {
            ...THEME_BG[theme],
            padding: '2rem',
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        createElement(Story)
      );
    },
  ],
};

export default preview;
