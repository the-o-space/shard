import { Vault, TFile } from 'obsidian';
import { CustomSection } from '../types';

export class SectionManager {
  private vault: Vault;
  private sectionsFilePath: string = '.obsidian/plugins/shard/sections.md';

  constructor(vault: Vault) {
    this.vault = vault;
  }
  
  async ensureSectionsFile(): Promise<TFile> {
    let file = this.vault.getAbstractFileByPath(this.sectionsFilePath) as TFile | null;
    if (!file) {
      const defaultContent = [
        '# Shard Sections',
        '',
        '# Define each section in a code block named `shard-section`',
        '# Example:',
        '# ```shard-section',
        '# name:: Resources',
        '# Resources || Rational',
        '# ```',
        ''
      ].join('\n');
      try {
        file = await this.vault.create(this.sectionsFilePath, defaultContent);
      } catch (e: any) {
        if (e.message.includes('File already exists') || e.message.includes('already exists')) {
          file = this.vault.getAbstractFileByPath(this.sectionsFilePath) as TFile;
        } else {
          console.error('Error creating sections file', e);
        }
      }
    }
    if (!(file instanceof TFile)) {
      throw new Error(`Cannot load or create sections file at ${this.sectionsFilePath}`);
    }
    return file;
  }

  async getSectionsFileContent(): Promise<string> {
    const tfile = await this.ensureSectionsFile();
    return await this.vault.cachedRead(tfile);
  }

  async saveSectionsFileContent(content: string): Promise<void> {
    const tfile = await this.ensureSectionsFile();
    await this.vault.modify(tfile, content);
  }

  async getSections(): Promise<CustomSection[]> {
    const content = await this.getSectionsFileContent();
    const result: CustomSection[] = [];
    const blockRegex = /```shard-section\n([\s\S]*?)```/g;
    let match;
    while ((match = blockRegex.exec(content)) !== null) {
      const block = match[1];
      const lines = block
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
      let name = '';
      const queries: string[] = [];
      lines.forEach(line => {
        if (line.toLowerCase().startsWith('name::')) {
          name = line.replace(/^[Nn]ame::\s*/, '');
        } else if (!line.startsWith('#')) {
          queries.push(line);
        }
      });
      if (name && queries.length > 0) {
        result.push({ name, query: queries.join(' ') });
      }
    }
    return result;
  }
} 