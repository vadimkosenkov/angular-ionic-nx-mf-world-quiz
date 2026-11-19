import { render, screen } from '@testing-library/angular';
import { QR_QUIET_ZONE, QrCode, qrMatrix, qrPath } from './qr-code';

describe('qrMatrix', () => {
  it('is a square of modules', () => {
    const matrix = qrMatrix('https://example.test/invite/K7M2X4PQ');

    expect(matrix.length).toBeGreaterThan(20);
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
  });

  it('carries the finder patterns in three corners', () => {
    const matrix = qrMatrix('K7M2X4PQ');
    const last = matrix.length - 1;
    const corner = (row: number, column: number) => matrix[row]![column]!;

    expect(corner(0, 0)).toBe(true);
    expect(corner(0, last)).toBe(true);
    expect(corner(last, 0)).toBe(true);
    // The fourth corner is where the alignment pattern is not.
    expect(corner(last, last)).toBe(false);
  });

  it('says something different for different text', () => {
    expect(qrPath(qrMatrix('one'))).not.toBe(qrPath(qrMatrix('two')));
  });
});

describe('qrPath', () => {
  it('draws one square per dark module, offset by the quiet zone', () => {
    const path = qrPath(
      [
        [true, false],
        [false, true],
      ],
      1,
    );

    expect(path).toBe('M1 1h1v1h-1zM2 2h1v1h-1z');
  });

  it('draws nothing for a matrix with no dark modules', () => {
    expect(
      qrPath([
        [false, false],
        [false, false],
      ]),
    ).toBe('');
  });
});

describe('QrCode', () => {
  it('sizes the drawing to the code plus its quiet zone', async () => {
    const value = 'https://example.test/invite/K7M2X4PQ';
    await render(QrCode, { inputs: { value, label: 'Your invite code' } });

    const svg = screen.getByRole('img', { name: 'Your invite code' });
    const side = qrMatrix(value).length + QR_QUIET_ZONE * 2;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${side} ${side}`);
    expect(svg.querySelector('path')?.getAttribute('d')).toContain('h1v1h-1z');
  });

  it('is decoration when nothing names it', async () => {
    await render(QrCode, { inputs: { value: 'K7M2X4PQ' } });

    expect(screen.queryByRole('img')).toBeNull();
  });
});
