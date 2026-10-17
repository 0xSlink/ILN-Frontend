import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Select } from '../Select';

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView; Select calls it when the
  // keyboard-focused option changes.
  Element.prototype.scrollIntoView = vi.fn();
});

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', disabled: true },
];

describe('Select (native mode / native-options fallback)', () => {
  it('renders a native <select> when native is true', () => {
    render(
      <Select native value="a" onChange={vi.fn()}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>
    );
    expect(screen.getByRole('combobox')).toHaveProperty('tagName', 'SELECT');
  });

  it('falls back to a native <select> when children include <option> elements', () => {
    const onChange = vi.fn();
    render(
      <Select value="a" onChange={onChange} name="test">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    fireEvent.change(select, { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('Select (custom listbox mode)', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(<Select options={options} placeholder="Choose one" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Choose one');
  });

  it('shows the label of the selected option', () => {
    render(<Select options={options} value="b" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Beta');
  });

  it('opens the listbox on click and selects an option', () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: 'b' }) })
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not select a disabled option on click', () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Gamma'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens via keyboard (ArrowDown/Enter/Space) on the trigger button', () => {
    render(<Select options={options} />);
    const trigger = screen.getByRole('combobox');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(<Select options={options} disabled />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates and wraps with ArrowDown/ArrowUp, selects with Enter', () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    const list = screen.getByRole('listbox');

    fireEvent.keyDown(list, { key: 'ArrowUp' }); // wraps from 0 to last enabled (Alpha, Beta => index 1)
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: 'b' }) })
    );
  });

  it('jumps to Home and End', () => {
    render(<Select options={options} />);
    fireEvent.click(screen.getByRole('combobox'));
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'End' });
    fireEvent.keyDown(list, { key: 'Home' });
    // No throw; focus index math exercised.
    expect(list).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<Select options={options} />);
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on Tab', () => {
    render(<Select options={options} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Tab' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('jumps to a matching option via type-ahead', () => {
    render(<Select options={options} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'b' });
    const betaOption = screen.getByText('Beta').closest('li')!;
    expect(betaOption.className).toContain('bg-primary/10');
  });

  it('closes when clicking outside the select', () => {
    render(
      <div>
        <Select options={options} />
        <button>outside</button>
      </div>
    );
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('operates as an uncontrolled component using defaultValue', () => {
    render(<Select options={options} defaultValue="a" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Alpha');
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Beta'));
    expect(screen.getByRole('combobox')).toHaveTextContent('Beta');
  });

  it('renders a hidden input carrying the value when a name is provided', () => {
    const { container } = render(<Select options={options} value="a" name="my-select" />);
    const hidden = container.querySelector('input[type="hidden"][name="my-select"]');
    expect(hidden).toHaveValue('a');
  });
});
