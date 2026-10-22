/**
 * Whether a key press belongs to a field being typed in, so the explorer's shortcuts (Esc, X,
 * [ and ]) leave it alone. A checkbox, radio, slider or button keeps focus after a click but
 * takes no text: the shortcuts still work there (Esc did nothing after ticking a box).
 */
export function typing(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  return (
    t.tagName === 'INPUT' &&
    !/^(checkbox|radio|range|button|submit|reset|color)$/.test((t as HTMLInputElement).type)
  );
}
