/** Where contacts can come from (design_handoff_network_onboarding 01–03). */
export interface ImportSource {
  id: 'hubspot' | 'outlook' | 'google' | 'csv' | 'manual';
  name: string;
  note: string;
  /** Text in the tile's icon circle. */
  mark: string;
}

/**
 * Sources shown on Paid and Home, in order. HubSpot, Outlook and Google
 * Contacts join this list when their OAuth import ships - until then they
 * are left out rather than shown disabled.
 */
export const IMPORT_SOURCES: ImportSource[] = [
  { id: 'csv', name: 'CSV file', note: 'Any spreadsheet export', mark: '↑' },
  { id: 'manual', name: 'Add one by hand', note: 'Start with a single person', mark: '+' },
];

/** Opens a source: the CSV import, or the add-contact form for "Add one by hand". */
export function openImportSource (
  source: ImportSource,
  router: { navigate: ( commands: string[] ) => Promise<boolean> },
  contactState: { resetContact: () => void },
): void {
  if ( source.id === 'manual' ) {
    contactState.resetContact();
    void router.navigate( ['/contact-edit'] );
    return;
  }
  void router.navigate( ['/contact-import'] );
}
