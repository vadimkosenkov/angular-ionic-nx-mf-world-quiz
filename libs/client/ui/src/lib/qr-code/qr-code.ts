import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import qrcode from 'qrcode-generator';

/**
 * How many empty modules surround the code. Four is what the standard asks
 * for: a scanner finds the pattern by its edges, and a code printed hard
 * against something else is a code that does not read.
 */
export const QR_QUIET_ZONE = 4;

/** A QR code as the square of modules it is: `true` is a dark one. */
export type QrMatrix = readonly (readonly boolean[])[];

/**
 * The modules of a QR code for `text`.
 *
 * The version (`0`) and the error correction (`M`) are chosen by the
 * library: an invite link is short, so the smallest code that fits is used,
 * and a quarter of it may be worn away before it stops reading.
 */
export function qrMatrix(text: string): QrMatrix {
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();
  const count = code.getModuleCount();
  return Array.from({ length: count }, (_row, row) =>
    Array.from({ length: count }, (_column, column) =>
      code.isDark(row, column),
    ),
  );
}

/**
 * The dark modules as one SVG path: a square per module, in the coordinates
 * of the matrix plus its quiet zone.
 *
 * One path rather than one `<rect>` per module — a code is a few hundred
 * modules, and that many elements is a page the browser lays out for
 * nothing.
 */
export function qrPath(matrix: QrMatrix, quietZone = QR_QUIET_ZONE): string {
  const parts: string[] = [];
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`);
    });
  });
  return parts.join('');
}

/**
 * A QR code, drawn as an SVG.
 *
 * It is **not** themed. A scanner looks for dark modules on a light
 * background, so the code keeps its own colours on a dark card as much as
 * on a light one; what the theme decides is the card around it.
 *
 * SVG rather than a canvas (which is how the share picture is drawn): a code
 * is a few hundred squares of one colour, it must stay crisp at any size,
 * and in a test the path is there to look at without a rendering context.
 */
@Component({
  selector: 'wq-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
      [attr.aria-label]="label()"
      [attr.role]="label() ? 'img' : 'presentation'"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path [attr.d]="path()" fill="#141a3a" shape-rendering="crispEdges" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: var(--wq-radius-sm);
    }
  `,
})
export class QrCode {
  /** What the code carries, usually an invite link. */
  readonly value = input.required<string>();
  /**
   * What a screen reader is told it is. Empty where the words beside it
   * already say so, which makes the code decoration.
   */
  readonly label = input('');

  private readonly matrix = computed(() => qrMatrix(this.value()));
  protected readonly size = computed(
    () => this.matrix().length + QR_QUIET_ZONE * 2,
  );
  protected readonly path = computed(() => qrPath(this.matrix()));
}
