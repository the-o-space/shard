import { TFile } from 'obsidian';

export interface ShardNode {
  files?: TFile[];
  [key: string]: any;
}

export interface ParsedShard {
  type: 'regular' | 'related' | 'parent' | 'child';
  value: string;
  cleanName?: string;
}

export interface FileRelations {
  related: TFile[];
  parents: TFile[];
  children: TFile[];
}

export interface RelationMaps {
  related: Map<string, TFile[]>;
  parents: Map<string, TFile[]>;
  children: Map<string, TFile[]>;
} 