import { TFile } from 'obsidian';

export interface ShardNode {
  files?: TFile[];
  [key: string]: any;
}

export interface ParsedShard {
  type: 'regular' | 'related' | 'parent' | 'child';
  value: string;
  cleanName?: string;
  label?: string;
}

export interface CustomSection {
  name: string;
  /**
   * Query string using shard paths combined with logical operators.
   * Use "||" to express OR (any shard matches) and "&" to express AND (all shards match).
   * Lines are trimmed before evaluation. Example: "Resource || Software/Open Source".
   */
  query: string;
} 