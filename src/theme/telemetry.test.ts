import {
  ACCENT_ORDER,
  CONTRAST_FLOOR,
  GEOMETRY,
  TELEMETRY_TOKENS,
  accent,
  accentForIndex,
  accentNameForIndex,
  contrastAgainstSurface,
  contrastRatio,
  parseHex,
  relativeLuminance,
  tokensFor,
  type ThemeMode,
} from './telemetry';

const MODES: ThemeMode[] = ['dark', 'light'];

describe('colour maths', () => {
  it('parses short and long hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('07080a')).toEqual([7, 8, 10]);
  });

  it('rejects anything that is not a hex colour', () => {
    expect(() => parseHex('rgb(0,0,0)')).toThrow(/Not a hex colour/);
  });

  it('computes the known WCAG anchors', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('takes the worse stop of a gradient surface', () => {
    const worse = contrastAgainstSurface('#ffffff', ['#000000', '#888888']);
    expect(worse).toBeCloseTo(contrastRatio('#ffffff', '#888888'), 5);
  });
});

/**
 * The handoff makes 4.5:1 a hard requirement, not a guideline: "there is no grey
 * text in this design … anything dimmer is a bug". These assertions are what
 * stops a later tweak from quietly reintroducing one.
 */
describe('contrast floor', () => {
  it.each(MODES)('%s text clears 4.5:1 on every surface it lands on', (mode) => {
    const tokens = tokensFor(mode);
    const surfaces = [
      tokens.bg.app,
      tokens.bg.chrome,
      tokens.bg.rail,
      tokens.bg.widget,
      tokens.bg.sheet,
    ];

    // Collected rather than asserted in the loop so a failure names the offending
    // role and surface instead of reporting a bare number on a shared line.
    const failures: string[] = [];
    for (const [role, colour] of Object.entries(tokens.text)) {
      if (role === 'onAccent') continue; // Printed on an accent fill, checked below.
      for (const surface of surfaces) {
        const ratio = contrastAgainstSurface(colour, surface);
        if (ratio < CONTRAST_FLOOR) {
          failures.push(`text.${role} (${colour}) on ${String(surface)} = ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it.each(MODES)('%s signal colours clear the floor on every surface', (mode) => {
    // These are read as text — a state chip, a threshold-coloured value — not just as fills, so
    // they answer to the same floor the rest of the palette does.
    const tokens = tokensFor(mode);
    const surfaces = [tokens.bg.app, tokens.bg.chrome, tokens.bg.rail, tokens.bg.widget, tokens.bg.sheet];

    const failures: string[] = [];
    for (const [role, colour] of Object.entries(tokens.signal)) {
      for (const surface of surfaces) {
        const ratio = contrastAgainstSurface(colour, surface);
        if (ratio < CONTRAST_FLOOR) {
          failures.push(`signal.${role} (${colour}) on ${String(surface)} = ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('spends no colour on "healthy" — that is the accent job', () => {
    // Two colours meaning "fine" would leave the accent saying nothing, and would cost green the
    // one meaning it carries on its own.
    expect(TELEMETRY_TOKENS.dark.signal).not.toHaveProperty('ok');
    expect(TELEMETRY_TOKENS.dark.signal).not.toHaveProperty('success');
  });

  it.each(MODES)('%s accent text clears the floor on the widget surface', (mode) => {
    const tokens = tokensFor(mode);
    for (const name of ACCENT_ORDER) {
      expect(contrastAgainstSurface(accent(mode, name).text, tokens.bg.widget)).toBeGreaterThanOrEqual(
        CONTRAST_FLOOR,
      );
    }
  });

  it.each(MODES)('%s endpoint chip text clears the floor on its own chip fill', (mode) => {
    for (const name of ACCENT_ORDER) {
      const { chip } = accent(mode, name);
      expect(contrastRatio(chip.text, chip.bg)).toBeGreaterThanOrEqual(CONTRAST_FLOOR);
    }
  });

  it.each(MODES)('%s button text clears the floor on every accent fill', (mode) => {
    const tokens = tokensFor(mode);
    for (const name of ACCENT_ORDER) {
      expect(contrastRatio(tokens.text.onAccent, accent(mode, name).fill)).toBeGreaterThanOrEqual(
        CONTRAST_FLOOR,
      );
    }
  });

  it('holds the documented dimmest values as the floor', () => {
    expect(TELEMETRY_TOKENS.dark.text.faint).toBe('#9aa39c');
    expect(TELEMETRY_TOKENS.light.text.faint).toBe('#57554d');
  });
});

describe('endpoint accents', () => {
  it('assigns lime, then cyan, then amber', () => {
    expect(accentNameForIndex(0)).toBe('lime');
    expect(accentNameForIndex(1)).toBe('cyan');
    expect(accentNameForIndex(2)).toBe('amber');
  });

  it('continues into the extended hues, then cycles', () => {
    expect(accentNameForIndex(3)).toBe('slate');
    expect(accentNameForIndex(7)).toBe('rose');
    expect(accentNameForIndex(8)).toBe('lime');
    expect(accentNameForIndex(9)).toBe('cyan');
  });

  it('survives the junk a persisted index can hold', () => {
    expect(accentNameForIndex(-1)).toBe('rose');
    expect(accentNameForIndex(Number.NaN)).toBe('lime');
    expect(accentNameForIndex(1.7)).toBe('cyan');
  });

  it('resolves per mode, so a theme switch re-colours the same endpoint', () => {
    expect(accentForIndex('dark', 0).stroke).toBe('#b6f24a');
    expect(accentForIndex('light', 0).stroke).toBe('#4e831a');
  });
});

describe('geometry', () => {
  it('keeps the handoff numbers', () => {
    expect(GEOMETRY.radius.widget).toBe(5);
    expect(GEOMETRY.gridGap).toBe(11);
    expect(GEOMETRY.minWidget).toEqual({ width: 260, height: 150 });
    expect(GEOMETRY.minRingDiameter).toBe(72);
  });
});
