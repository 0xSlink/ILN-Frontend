import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLPWidgetLayout } from '../useLPWidgetLayout';

const DEFAULT_IDS = [
  'portfolio-summary',
  'analytics-chart',
  'yield-comparison',
  'risk-summary',
  'insurance-pool',
  'portfolio-table',
];

describe('useLPWidgetLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads the default widget layout, fully visible and marked loaded, when there is no user id', () => {
    const { result } = renderHook(() => useLPWidgetLayout(null));
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.widgets.map((w) => w.id)).toEqual(DEFAULT_IDS);
    expect(result.current.visibleWidgets).toHaveLength(DEFAULT_IDS.length);
  });

  it('loads the default layout for a user with no saved config', () => {
    const { result } = renderHook(() => useLPWidgetLayout('GLP1'));
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.widgets.map((w) => w.id)).toEqual(DEFAULT_IDS);
  });

  it('restores a previously saved layout for the user', () => {
    const saved = [
      { id: 'portfolio-summary', label: 'Portfolio Summary', visible: false, order: 0 },
    ];
    localStorage.setItem('iln_lp_widget_layout_GLP1', JSON.stringify(saved));

    const { result } = renderHook(() => useLPWidgetLayout('GLP1'));
    expect(result.current.widgets).toEqual(saved);
    expect(result.current.visibleWidgets).toHaveLength(0);
  });

  it('falls back to defaults when the saved config is corrupt JSON', () => {
    localStorage.setItem('iln_lp_widget_layout_GLP1', '{not-json');
    const { result } = renderHook(() => useLPWidgetLayout('GLP1'));
    expect(result.current.widgets.map((w) => w.id)).toEqual(DEFAULT_IDS);
  });

  it('toggles a widget visibility and persists it', () => {
    const { result } = renderHook(() => useLPWidgetLayout('GLP1'));

    act(() => result.current.toggleWidget('risk-summary'));
    expect(result.current.widgets.find((w) => w.id === 'risk-summary')?.visible).toBe(false);
    expect(result.current.visibleWidgets.some((w) => w.id === 'risk-summary')).toBe(false);

    const stored = JSON.parse(localStorage.getItem('iln_lp_widget_layout_GLP1')!);
    expect(stored.find((w: any) => w.id === 'risk-summary').visible).toBe(false);

    act(() => result.current.toggleWidget('risk-summary'));
    expect(result.current.widgets.find((w) => w.id === 'risk-summary')?.visible).toBe(true);
  });

  it('reorders widgets and reassigns their order field', () => {
    const { result } = renderHook(() => useLPWidgetLayout('GLP1'));

    act(() => result.current.reorderWidgets(0, 2));
    expect(result.current.widgets.map((w) => w.id)).toEqual([
      'analytics-chart',
      'yield-comparison',
      'portfolio-summary',
      'risk-summary',
      'insurance-pool',
      'portfolio-table',
    ]);
    expect(result.current.widgets.map((w) => w.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('resets to the default layout and clears storage', () => {
    const { result } = renderHook(() => useLPWidgetLayout('GLP1'));
    act(() => result.current.toggleWidget('risk-summary'));
    expect(localStorage.getItem('iln_lp_widget_layout_GLP1')).not.toBeNull();

    act(() => result.current.resetLayout());
    expect(result.current.widgets.map((w) => w.id)).toEqual(DEFAULT_IDS);
    expect(result.current.widgets.every((w) => w.visible)).toBe(true);
    expect(localStorage.getItem('iln_lp_widget_layout_GLP1')).toBeNull();
  });

  it('updateWidgets replaces the whole layout and persists it', () => {
    const { result } = renderHook(() => useLPWidgetLayout('GLP1'));
    const custom = [{ id: 'portfolio-table', label: 'Portfolio Table', visible: true, order: 0 }];

    act(() => result.current.updateWidgets(custom));
    expect(result.current.widgets).toEqual(custom);
    expect(JSON.parse(localStorage.getItem('iln_lp_widget_layout_GLP1')!)).toEqual(custom);
  });

  it('does not persist changes when there is no user id', () => {
    const { result } = renderHook(() => useLPWidgetLayout(null));
    act(() => result.current.toggleWidget('risk-summary'));
    expect(localStorage.length).toBe(0);
  });
});
