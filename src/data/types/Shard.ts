import { Hierarchies } from "./Hierarchy";
import { Relations } from "./Relation";
import { TFile } from "obsidian";

export type Shard = {
    file: TFile;
    hierarchies: Hierarchies;
    relations: Relations;
}

export type Shards = Map<TFile, Shard>;