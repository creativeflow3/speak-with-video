export interface CsvExport {
  csv: string;
  cardCount: number;
}

export interface ToolContext {
  userId: string;
  /**
   * The vocabulary list the user picked in the chat panel. Set server-side from the request,
   * never by the model, so a prompt-injected list name can't redirect writes.
   */
  listId?: string;
  onExport: (event: string, data: CsvExport) => void;
}
