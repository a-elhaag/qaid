'use server';
import { requireOffice } from './auth';
import { isDemoEmail, tourCleanup } from './tour';

export async function endTour(since: string) {
  const { officeId, email } = await requireOffice();
  if (!isDemoEmail(email) || Number.isNaN(Date.parse(since))) return 0;
  return tourCleanup(officeId, since);
}
