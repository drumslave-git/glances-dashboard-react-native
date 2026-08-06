import { tokensFor } from '@/theme/telemetry';

import {
  APPEARANCE_KEYS,
  DEFAULT_APPEARANCE,
  colorFor,
  cssColor,
  hasTranslucency,
  isDefaultAppearance,
  isDefaultAppearanceKey,
  isDefaultWidgetAppearance,
  parseAppearance,
  parseWidgetAppearance,
  sameThemedColor,
  widgetSurface,
  type Appearance,
} from './appearance';

const opaque = (color: string) => ({ light: { color, alpha: 1 }, dark: { color, alpha: 1 } });

describe('parseAppearance', () => {
  it('fills every key from the defaults when there is nothing stored', () => {
    expect(parseAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance('nonsense')).toEqual(DEFAULT_APPEARANCE);
  });

  it('keeps the good keys when one is unreadable', () => {
    // A field falling back on its own is the whole point: a bad colour must not cost the user
    // their spacing as well.
    const parsed = parseAppearance({
      gridGap: 20,
      widgetBackground: { light: 'not a colour' },
    });

    expect(parsed.gridGap).toBe(20);
    expect(parsed.widgetBackground).toEqual(DEFAULT_APPEARANCE.widgetBackground);
  });

  it('accepts a stored colour, lowercasing the hex so comparisons are stable', () => {
    const parsed = parseAppearance({ gridBackground: opaque('#AABBCC') });
    expect(parsed.gridBackground.dark.color).toBe('#aabbcc');
  });

  it('refuses a size outside its range, and an alpha outside 0–1', () => {
    expect(parseAppearance({ gridGap: 900 }).gridGap).toBe(DEFAULT_APPEARANCE.gridGap);
    expect(parseAppearance({ gridGap: -4 }).gridGap).toBe(DEFAULT_APPEARANCE.gridGap);
    expect(
      parseAppearance({ gridBackground: { light: { color: '#000000', alpha: 4 }, dark: { color: '#000000', alpha: 1 } } })
        .gridBackground,
    ).toEqual(DEFAULT_APPEARANCE.gridBackground);
  });

  it('clamps the interface scale to what the type scale will honour', () => {
    expect(parseAppearance({ interfaceScale: 2.9 }).interfaceScale).toBeLessThan(2.9);
    expect(parseAppearance({ interfaceScale: 0.6 }).interfaceScale).toBeGreaterThan(0.6);
  });
});

describe('defaults', () => {
  it('are the design own surfaces, not a copy of them', () => {
    expect(DEFAULT_APPEARANCE.gridBackground.dark.color).toBe(tokensFor('dark').bg.app);
    expect(DEFAULT_APPEARANCE.gridBackground.light.color).toBe(tokensFor('light').bg.app);
  });

  it('are fully opaque — translucency is offered, never assumed', () => {
    expect(hasTranslucency(DEFAULT_APPEARANCE)).toBe(false);
  });

  it('report themselves as default, per key and as a whole', () => {
    expect(isDefaultAppearance(DEFAULT_APPEARANCE)).toBe(true);
    for (const key of APPEARANCE_KEYS) {
      expect(isDefaultAppearanceKey(DEFAULT_APPEARANCE, key)).toBe(true);
    }
  });

  it('notice a single changed key without claiming the rest changed', () => {
    const changed: Appearance = { ...DEFAULT_APPEARANCE, gridGap: 18 };
    expect(isDefaultAppearanceKey(changed, 'gridGap')).toBe(false);
    expect(isDefaultAppearanceKey(changed, 'widgetPadding')).toBe(true);
    expect(isDefaultAppearance(changed)).toBe(false);
  });

  it('compare a border by both halves', () => {
    const width: Appearance = {
      ...DEFAULT_APPEARANCE,
      widgetBorder: { ...DEFAULT_APPEARANCE.widgetBorder, width: 2 },
    };
    const color: Appearance = {
      ...DEFAULT_APPEARANCE,
      widgetBorder: { ...DEFAULT_APPEARANCE.widgetBorder, color: opaque('#ff0000') },
    };
    expect(isDefaultAppearanceKey(width, 'widgetBorder')).toBe(false);
    expect(isDefaultAppearanceKey(color, 'widgetBorder')).toBe(false);
  });
});

describe('cssColor', () => {
  it('leaves an opaque colour as its hex', () => {
    expect(cssColor({ color: '#07080a', alpha: 1 })).toBe('#07080a');
  });

  it('expands a translucent one into rgba', () => {
    expect(cssColor({ color: '#ff8000', alpha: 0.5 })).toBe('rgba(255, 128, 0, 0.5)');
    expect(cssColor({ color: '#000000', alpha: 0 })).toBe('rgba(0, 0, 0, 0)');
  });

  it('resolves the half belonging to the scheme on screen', () => {
    const color = { light: { color: '#ffffff', alpha: 1 }, dark: { color: '#000000', alpha: 1 } };
    expect(colorFor(color, 'light')).toBe('#ffffff');
    expect(colorFor(color, 'dark')).toBe('#000000');
  });
});

describe('hasTranslucency', () => {
  it('is true as soon as one half of one colour is translucent', () => {
    const appearance: Appearance = {
      ...DEFAULT_APPEARANCE,
      gridBackground: { light: { color: '#ffffff', alpha: 1 }, dark: { color: '#000000', alpha: 0.6 } },
    };
    expect(hasTranslucency(appearance)).toBe(true);
  });

  it('counts a single widget override, which is enough to need the window', () => {
    expect(
      hasTranslucency(DEFAULT_APPEARANCE, [
        { background: { light: { color: '#ffffff', alpha: 0.4 }, dark: { color: '#000000', alpha: 0.4 } } },
      ]),
    ).toBe(true);
    expect(hasTranslucency(DEFAULT_APPEARANCE, [null, { background: null }])).toBe(false);
  });
});

describe('widgetSurface', () => {
  it('keeps the design gradient while the setting is untouched', () => {
    expect(widgetSurface(DEFAULT_APPEARANCE, 'dark')).toEqual(tokensFor('dark').bg.widget);
  });

  it('paints flat once the user picks a colour', () => {
    const appearance: Appearance = { ...DEFAULT_APPEARANCE, widgetBackground: opaque('#123456') };
    expect(widgetSurface(appearance, 'dark')).toEqual(['#123456', '#123456']);
  });

  it('lets one widget override the lot, gradient included', () => {
    expect(widgetSurface(DEFAULT_APPEARANCE, 'dark', opaque('#abcdef'))).toEqual(['#abcdef', '#abcdef']);
  });

  it('carries the alpha into the fill', () => {
    const appearance: Appearance = {
      ...DEFAULT_APPEARANCE,
      widgetBackground: { light: { color: '#ffffff', alpha: 0.5 }, dark: { color: '#101010', alpha: 0.5 } },
    };
    expect(widgetSurface(appearance, 'dark')[0]).toBe('rgba(16, 16, 16, 0.5)');
  });
});

describe('widget appearance', () => {
  it('treats a missing record as inheriting', () => {
    expect(parseWidgetAppearance(undefined)).toEqual({ background: null });
    expect(isDefaultWidgetAppearance(null)).toBe(true);
    expect(isDefaultWidgetAppearance({ background: null })).toBe(true);
  });

  it('keeps an override it can read', () => {
    const value = { background: opaque('#101010') };
    expect(parseWidgetAppearance(value)).toEqual(value);
    expect(isDefaultWidgetAppearance(value)).toBe(false);
  });

  it('falls back rather than throwing on nonsense', () => {
    expect(parseWidgetAppearance({ background: 'blue' })).toEqual({ background: null });
  });
});

describe('sameThemedColor', () => {
  it('compares both schemes and both alphas', () => {
    expect(sameThemedColor(opaque('#000000'), opaque('#000000'))).toBe(true);
    expect(sameThemedColor(opaque('#000000'), opaque('#000001'))).toBe(false);
    expect(
      sameThemedColor(opaque('#000000'), {
        light: { color: '#000000', alpha: 1 },
        dark: { color: '#000000', alpha: 0.5 },
      }),
    ).toBe(false);
  });
});
