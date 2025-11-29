export interface Quote {
  quote: string;
  author: string;
  meaning: string;
  tags: string[];
}

export interface QuoteResponse {
  date: string; // ISO date string
  data: Quote;
}

export interface StoredQuote extends QuoteResponse {
  viewedAt: number;
}