export interface CsvExport {
  csv: string;
  cardCount: number;
}

export interface ToolContext {
  userId: string;
  onExport: (event: string, data: CsvExport) => void;
}
