import { TFile } from "obsidian";
import { RelationType } from "../enums/RelationType";

export type Relation = {
    source: TFile;
    target: TFile;

    type: RelationType;
    label: string;
    infer: boolean;
}

export type Relations = Relation[];