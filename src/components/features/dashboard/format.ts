const DATE_FORMAT = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function formatDate(date: Date): string {
  return DATE_FORMAT.format(date);
}
