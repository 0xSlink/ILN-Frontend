import fs from 'node:fs';
import path from 'node:path';

function scaffold() {
  const args = process.argv.slice(2);
  const componentInput = args[0];

  if (!componentInput) {
    console.error('Error: Please provide a component name.');
    console.error('Usage: pnpm scaffold:component <ComponentName>');
    console.error('Example: pnpm scaffold:component CustomCard');
    console.error('Example: pnpm scaffold:component ui/CustomCard');
    process.exit(1);
  }

  // Parse path and component base name
  const normalizedPath = componentInput.replace(/\\/g, '/');
  const pathParts = normalizedPath.split('/').filter(Boolean);
  const rawComponentName = pathParts.pop() || '';

  if (!rawComponentName) {
    console.error('Error: Invalid component name specified.');
    process.exit(1);
  }

  // Capitalize first letter of component name
  const componentName = rawComponentName.charAt(0).toUpperCase() + rawComponentName.slice(1);
  const subPath = pathParts.join('/');

  const baseDir = path.join(process.cwd(), 'src', 'components', subPath);
  const testsDir = path.join(baseDir, '__tests__');

  const componentFilePath = path.join(baseDir, `${componentName}.tsx`);
  const storyFilePath = path.join(baseDir, `${componentName}.stories.tsx`);
  const testFilePath = path.join(testsDir, `${componentName}.test.tsx`);

  // Ensure directories exist
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(testsDir, { recursive: true });

  // Check if component already exists
  if (fs.existsSync(componentFilePath)) {
    console.error(`Error: Component file already exists at ${componentFilePath}`);
    process.exit(1);
  }

  // 1. Component template
  const componentTemplate = `import React from 'react';

export interface ${componentName}Props {
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

export const ${componentName}: React.FC<${componentName}Props> = ({
  title,
  children,
  className = '',
}) => {
  return (
    <div className={\`p-4 rounded-xl border border-outline-variant/30 bg-surface \${className}\`}>
      {title && <h3 className="text-lg font-bold text-on-surface mb-2">{title}</h3>}
      {children}
    </div>
  );
};

export default ${componentName};
`;

  // 2. Storybook story template
  const storyCategory = subPath ? `${subPath}/` : '';
  const storyTemplate = `import type { Meta, StoryObj } from '@storybook/react';
import { ${componentName} } from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
  title: 'Components/${storyCategory}${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: '${componentName} Title',
    children: 'This is sample content inside ${componentName}.',
  },
};
`;

  // 3. Test stub template
  const testTemplate = `import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ${componentName} from '../${componentName}';

describe('${componentName}', () => {
  it('renders correctly with title and content', () => {
    render(<${componentName} title="Test Title">Test Content</${componentName}>);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});
`;

  fs.writeFileSync(componentFilePath, componentTemplate, 'utf8');
  fs.writeFileSync(storyFilePath, storyTemplate, 'utf8');
  fs.writeFileSync(testFilePath, testTemplate, 'utf8');

  console.error(`Successfully scaffolded ${componentName}:`);
  console.error(`  - Component: ${path.relative(process.cwd(), componentFilePath)}`);
  console.error(`  - Story:     ${path.relative(process.cwd(), storyFilePath)}`);
  console.error(`  - Test:      ${path.relative(process.cwd(), testFilePath)}`);
}

scaffold();
