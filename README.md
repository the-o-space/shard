# Shard - Advanced File Organization for Obsidian

Shard is an Obsidian plugin that provides a powerful, flexible file organization system using custom code blocks. It replaces the default file explorer with a dynamic view based on "shards" - tags that support hierarchical expansion and various relationship types.

## Features

- **Custom Shard Syntax**: Define shards in code blocks within your notes
- **Hierarchical Organization**: Create nested structures with `/` separators
- **Expansion Syntax**: Use `{option1,option2}` to create multiple shards at once
- **Multiple Relationship Types**: Related (`=`), Parent (`>`), and Child (`<`) relationships
- **Visual Distinction**: Different symbols and colors for different relationship types

## Usage

### Basic Shards

Add a `shards` code block anywhere in your note:

```markdown
```shards
Hardware
Software
Personal Projects
```
```

### Hierarchical Shards

Use `/` to create hierarchical structures:

```markdown
```shards
Tech/Hardware/Laptop
Tech/Software/IDE
Work/Projects/Current
```
```

### Expansion Syntax

Use `{}` to expand multiple options:

```markdown
```shards
Tech/{Hardware,Software}
Work/Projects/{Current,Archived,Ideas}
Tech/Hardware/{Laptop,Desktop,Mobile}
```
```

This expands to:
- Tech/Hardware
- Tech/Software
- Work/Projects/Current
- Work/Projects/Archived
- Work/Projects/Ideas
- Tech/Hardware/Laptop
- Tech/Hardware/Desktop
- Tech/Hardware/Mobile

### Relationship Syntax

Define relationships between notes using special prefixes:

```markdown
```shards
Hardware
Software

= [[Related Note]]
= Another Related Note

> [[Parent Topic]]
> Higher Level Concept

< [[Sub Topic]]
< Detailed Implementation
```
```

- `=` creates bidirectional relationships (shown with ↔)
- `>` indicates parent topics (shown with ↑)
- `<` indicates child/subtopics (shown with ↓)

## Visual Indicators

- **↔ Related**: Bidirectional relationships (accent color)
- **↑ Parents**: Parent topics (success/green color)
- **↓ Children**: Child topics (warning/yellow color)
- **← →**: Files connected through relationships

## Settings

- **Replace Default File Explorer**: Automatically replace the file explorer with Shard view on startup

## Commands

- **Open Shard View**: Manually open the Shard view (useful if you've closed it)

## Example

A complete example note might look like:

```markdown
# My Hardware Review

```shards
Tech/Hardware/Laptop
Reviews/2024
Brand/Dell

= [[Dell XPS Overview]]
= [[Laptop Buying Guide]]

> [[Computer Hardware]]
> [[Tech Reviews]]

< [[XPS 13 Specific Features]]
< [[Battery Life Tests]]
```

This is my review of the Dell XPS laptop...
```

## Installation

1. Download the plugin files
2. Place them in your `.obsidian/plugins/shard/` folder
3. Enable the plugin in Obsidian settings

## Why Code Blocks Instead of Frontmatter?

Using code blocks provides several advantages:
- No YAML syntax restrictions
- Support for custom symbols and operators
- Ability to place shards anywhere in the document
- Future extensibility for new features
- No conflicts with other frontmatter properties
