import { DEFAULT_APPEARANCE } from '@/theme/appearance';

import { selectAppearance, usePreferencesStore } from './preferences';

const store = () => usePreferencesStore.getState();

beforeEach(() => {
  usePreferencesStore.setState({
    theme: 'dark',
    summaryStripVisible: true,
    appearance: DEFAULT_APPEARANCE,
    appearanceDraft: null,
  });
});

describe('the appearance draft', () => {
  it('is what everything reads while an editor is open', () => {
    expect(selectAppearance(store())).toBe(DEFAULT_APPEARANCE);

    store().setAppearanceDraft('gridGap', 24);

    // The board repaints from the draft — that *is* the live preview, and it is why there is no
    // preview surface to keep in step.
    expect(selectAppearance(store()).gridGap).toBe(24);
    expect(store().appearance.gridGap).toBe(DEFAULT_APPEARANCE.gridGap);
  });

  it('starts itself, so a control does not have to open the editor first', () => {
    store().setAppearanceDraft('widgetRadius', 12);
    expect(store().appearanceDraft).not.toBeNull();
  });

  it('is dropped by cancel, with nothing to undo', () => {
    store().setAppearanceDraft('gridGap', 24);
    store().cancelAppearance();

    expect(store().appearanceDraft).toBeNull();
    expect(store().appearance.gridGap).toBe(DEFAULT_APPEARANCE.gridGap);
  });

  it('becomes the stored appearance on commit', () => {
    store().setAppearanceDraft('gridGap', 24);
    store().commitAppearance();

    expect(store().appearance.gridGap).toBe(24);
    expect(store().appearanceDraft).toBeNull();
  });

  it('commits nothing when there was no draft', () => {
    const before = store().appearance;
    store().commitAppearance();
    expect(store().appearance).toBe(before);
  });

  it('begins from what is on screen, and does not restart mid-edit', () => {
    store().setAppearanceDraft('gridGap', 24);
    store().beginAppearanceEdit();
    expect(store().appearanceDraft?.gridGap).toBe(24);
  });
});

describe('resets', () => {
  it('put one key back without touching the others', () => {
    store().setAppearanceDraft('gridGap', 24);
    store().setAppearanceDraft('widgetRadius', 16);
    store().resetAppearanceKey('gridGap');

    expect(store().appearanceDraft?.gridGap).toBe(DEFAULT_APPEARANCE.gridGap);
    expect(store().appearanceDraft?.widgetRadius).toBe(16);
  });

  it('reset everything is still a draft, so it can be cancelled like any other edit', () => {
    store().setAppearanceDraft('gridGap', 24);
    store().commitAppearance();

    store().resetAppearance();
    expect(store().appearance.gridGap).toBe(24);
    expect(store().appearanceDraft).toEqual(DEFAULT_APPEARANCE);

    store().cancelAppearance();
    expect(store().appearance.gridGap).toBe(24);
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
    // It was always the same number. Moving it means one Cancel undoes an experiment with the text
    // size as readily as one with the colours.
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
