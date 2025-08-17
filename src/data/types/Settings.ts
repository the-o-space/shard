import { RelationType } from "../enums/RelationType";

export type Settings = {
    autoInferRelations: boolean;
    
    inferredRelations: Record<RelationType, RelationType>;   
}