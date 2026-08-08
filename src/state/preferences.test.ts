import { DEFAULT_APPEARANCE } from '@/theme/appearance';

import { selectAppearance, usePreferencesStore } from './preferences';

const store = () => usePreferencesStore.getState();

beforeEach(() => {
  usePreferencesStore.setState({
    theme: 'dark',
    summaryStripVisible: true,
    appearance: DEFAULT_APPEARANCE,
  });
});

describe('setting appearance', () => {
  it('applies immediately — the board is the preview, so there is nothing to commit', () => {
    expect(selectAppearance(store())).toBe(DEFAULT_APPEARANCE);

    store().setAppearance('gridGap', 24);

    expect(selectAppearance(store()).gridGap).toBe(24);
    expect(store().appearance.gridGap).toBe(24);
  });

  it('changes only the key it was given', () => {
    store().setAppearance('widgetRadius', 12);

    expect(store().appearance.widgetRadius).toBe(12);
    expect(store().appearance.gridGap).toBe(DEFAULT_APPEARANCE.gridGap);
  });
});

describe('resets', () => {
  it('put one key back without touching the others', () => {
    store().setAppearance('gridGap', 24);
    store().setAppearance('widgetRadius', 16);
    store().resetAppearanceKey('gridGap');

    expect(store().appearance.gridGap).toBe(DEFAULT_APPEARANCE.gridGap);
    expect(store().appearance.widgetRadius).toBe(16);
  });

  it('reset everything is the way back to a fresh install', () => {
    store().setAppearance('gridGap', 24);
    store().setAppearance('widgetRadius', 16);

    store().resetAppearance();
    expect(store().appearance).toEqual(DEFAULT_APPEARANCE);
  });
});

describe('migration', () => {
  /** The persist middleware's `migrate`, reached the way zustand reaches it. */
  const migrate = (persisted: unknown, version: number) =>
    (usePreferencesStore.persist.getOptions().migrate as (state: unknown, version: number) => unknown)(
      persisted,
      version,
    ) as { appearance: typeof DEFAULT_APPEARANCE; theme?: string };

  it('lifts a v1 reading scale into the appearance model', () => {
    const migrated = migrate({ theme: 'light', readingScale: 1.2, summaryStripVisible: false }, 1);

    expect(migrated.appearance.interfaceScale).toBe(1.2);
    expect(migrated.theme).toBe('light');
  });

  it('gives a v1 store without a scale the defaults', () => {
    expect(migrate({ theme: 'dark' }, 1).appearance).toEqual(DEFAULT_APPEARANCE);
  });

  it('parses a v2 appearance per key rather than trusting it', () => {
    const migrated = migrate({ appearance: { gridGap: 20, widgetRadius: 'nonsense' } }, 2);

    expect(migrated.appearance.gridGap).toBe(20);
    expect(migrated.appearance.widgetRadius).toBe(DEFAULT_APPEARANCE.widgetRadius);
  });
});
