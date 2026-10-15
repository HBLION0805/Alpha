export type Stance = "left" | "center" | "right" | "cn_official" | "us_official";

export interface Source {
  id: string;
  name: string;
  stance: Stance;
  tier: 1 | 2 | 3;
  url: string;
  enabled: boolean;
  kind?: "rss" | "alpaca" | "xfile" | "truthapi";
  note?: string;
}

export interface FeedItem {
  sourceId: string;
  title: string;
  url: string;
  publishedAt: string; // ISO UTC
  summary: string;
  guid?: string;
}

export interface StoredItem extends FeedItem {
  id: number;
  stance: Stance;
  tier: number;
  fetchedAt: string;
}

export interface Cluster {
  id: string;
  items: StoredItem[];
  tokens: Set<string>;
  firstSeen: string;
  lastSeen: string;
}
