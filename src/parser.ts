import { ParsedShard } from './types';

export class ShardParser {
  parseShardsFromContent(content: string): string[] {
    const shards: string[] = [];
    
    // Match code blocks with language 'shards'
    const codeBlockRegex = /```shards\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const blockContent = match[1];
      // Split by lines and filter out empty lines
      const lines = blockContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      shards.push(...lines);
    }
    
    return shards;
  }

  parseShard(shardStr: string): ParsedShard {
    const trimmed = shardStr.trim();
    
    if (trimmed.startsWith('=')) {
      return {
        type: 'related',
        value: trimmed.slice(1).trim(),
        cleanName: this.cleanPageName(trimmed.slice(1).trim())
      };
    } else if (trimmed.startsWith('>')) {
      return {
        type: 'parent',
        value: trimmed.slice(1).trim(),
        cleanName: this.cleanPageName(trimmed.slice(1).trim())
      };
    } else if (trimmed.startsWith('<')) {
      return {
        type: 'child',
        value: trimmed.slice(1).trim(),
        cleanName: this.cleanPageName(trimmed.slice(1).trim())
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