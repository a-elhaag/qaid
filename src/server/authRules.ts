export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/board';
  return next;
}

export function assertSameOffice(rowOfficeId: string | null | undefined, officeId: string): void {
  if (!rowOfficeId || rowOfficeId !== officeId) throw new Error('forbidden');
}
