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

export interface RelationEntry {
  file: TFile;
  label?: string;
}

export interface FileRelations {
  related: RelationEntry[];
  parents: RelationEntry[];
  children: RelationEntry[];
}

export interface RelationMaps {
  related: Map<string, TFile[]>;
  parents: Map<string, TFile[]>;
  children: Map<string, TFile[]>;
} 