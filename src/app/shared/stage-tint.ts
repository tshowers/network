/**
 * The tint for a relationship stage (design_handoff_music_leadvault_network
 * 15c/15f): Lead Generation cyan, Qualification blue, Engagement violet,
 * Proposal yellow, Negotiation pink, later stages green, the rest grey.
 */
export function stageTint ( status: string | null | undefined ): string {
  const key = ( status || '' ).trim().toLowerCase();
  if ( !key ) return 'grey';
  if ( key.startsWith( 'lead' ) ) return 'cyan';
  if ( key.startsWith( 'qualif' ) ) return 'blue';
  if ( key.startsWith( 'engag' ) ) return 'violet';
  if ( key.startsWith( 'proposal' ) ) return 'yellow';
  if ( key.startsWith( 'negotiat' ) ) return 'pink';
  if ( /^(closing|closed|post|deliver|customer|won)/.test( key ) ) return 'green';
  return 'grey';
}

/** Up to two initials from a display name. */
export function initialsOf ( name: string | null | undefined ): string {
  const parts = ( name || '' ).trim().split( /\s+/ ).filter( Boolean );
  if ( !parts.length ) return '?';
  return ( parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice( 0, 1 ) ).toUpperCase();
}
