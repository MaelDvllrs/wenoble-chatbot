const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
