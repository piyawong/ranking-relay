// UI Component Types

export interface TableColumn<T = unknown> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: T) => React.ReactNode;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  label?: string;
}

export interface PerformanceData {
  timestamp: string;
  latency: number;
  loss: number;
  ranking: number;
}

export interface FilterOptions {
  relayName?: string;
  blockNumber?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}