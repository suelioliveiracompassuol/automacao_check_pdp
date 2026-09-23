import { redirect } from 'next/navigation';

/** /visao-geral's content moved to the home page (/), now with a per-platform breakdown.
 * Kept as a redirect so older links/bookmarks keep working. */
export default function LegacyVisaoGeralRedirect() {
  redirect('/');
}
