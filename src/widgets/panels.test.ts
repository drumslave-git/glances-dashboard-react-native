import { reading } from './panels';
import { formatRate } from './rates';

describe('reading', () => {
  it('keeps the unit out of the text', () => {
    // The hero draws the value and the unit as two elements; a unit in both renders "1.7%%".
    const cpu = reading('total', 'Total', 1.7, { unit: '%' });
    expect(cpu.text).toBe('1.7');
    expect(cpu.unit).toBe('%');
  });

  it('lets a caller supply text that does carry its own units', () => {
    const memory = reading('total', 'TOTAL', 5, { text: '5.39 GB / 123 GB' });
    expect(memory.text).toBe('5.39 GB / 123 GB');
  });

  it('renders a missing value as a dash rather than a zero', () => {
    expect(reading('x', 'X', null, { unit: '%' }).text).toBe('—');
  });

  it('drops a decimal above 100, where it is noise', () => {
    expect(reading('x', 'X', 123.45).text).toBe('123');
    expect(reading('x', 'X', 12.34).text).toBe('12.3');
  });
});

describe('SeriesPanel stat formatting', () => {
  it('is what lets a rate widget print its peak as a rate', () => {
    // Not a render test — the contract is that the caller supplies the printer, because a peak of
    // 504744 is a byte count and reads as noise beside a hero saying "493 KB/s".
    const print = (value: number) => formatRate(value);
    expect(print(504744)).toBe('493 KB/s');
  });
});
