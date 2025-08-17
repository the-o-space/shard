import { ParsedShard } from '../types';

export class ShardParser {
  parseShardsFromContent(content: string): string[] {
    const shards: string[] = [];
    const codeBlockRegex = /```shards\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const blockContent = match[1];
      const lines = blockContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      shards.push(...lines);
    }
    return shards;
  }

  parseShard(shardStr: string): ParsedShard {
    const trimmed = shardStr.trim();
    const getLabelAndRest = (str: string): { label?: string; rest: string } => {
      let label: string | undefined;
      let rest = str.trim();
      if (rest.startsWith('"')) {
        const match = rest.match(/^"([^"]+)"\s+(.*)$/);
        if (match) {
          label = match[1];
          rest = match[2].trim();
        }
      }
      return { label, rest };
    };

    if (trimmed.startsWith('=')) {
      const { label, rest } = getLabelAndRest(trimmed.slice(1));
      return {
        type: 'related',
        value: rest,
        cleanName: this.cleanPageName(rest),
        label
      };
    } else if (trimmed.startsWith('>')) {
      const { label, rest } = getLabelAndRest(trimmed.slice(1));
      return {
        type: 'child',
        value: rest,
        cleanName: this.cleanPageName(rest),
        label
      };
    } else if (trimmed.startsWith('<')) {
      const { label, rest } = getLabelAndRest(trimmed.slice(1));
      return {
        type: 'parent',
        value: rest,
        cleanName: this.cleanPageName(rest),
        label
      };
    } else {
      return {
        type: 'regular',
        value: trimmed
      };
    }
  }

  cleanPageName(name: string): string {
    // Remove [[ ]] if present
    return name.replace(/^\[\[|\]\]$/g, '');
  }

  expandMultiShard(str: string): string[] {
    const match = str.match(/\{([^}]+)\}/);
    if (!match) return [str];
    const prefix = str.slice(0, match.index);
    const suffix = str.slice((match.index ?? 0) + match[0].length);
    const options = match[1].split(',').map(o => o.trim());
    // Recursively expand the suffix in case there are multiple { } groups
    const expandedSuffixes = this.expandMultiShard(suffix);
    const result: string[] = [];
    options.forEach(opt => {
      expandedSuffixes.forEach(suf => {
        result.push(prefix + opt + suf);
      });
    });
    return result;
  }
} 