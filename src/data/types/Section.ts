import iFilterExpression from "../interfaces/FilterExpression";

class TagExpression implements iFilterExpression { 
    constructor(public readonly tag: string) {}
  }

class RelationExpression implements iFilterExpression {
constructor(
    public readonly operator: '<' | '>' | '~' | string,
    public readonly target: string
) {}
}

class BinaryExpression implements iFilterExpression {
    constructor(
      public readonly op: '&&' | '||',
      public readonly left: iFilterExpression,
      public readonly right: iFilterExpression
    ) {}
}

class ParenthesizedExpression implements iFilterExpression {
    constructor(public readonly inner: iFilterExpression) {}
}

export type SectionFilter = iFilterExpression;

export type Section = {
  name: string;
  filter: SectionFilter;
};

export type Sections = Section[];