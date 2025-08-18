export const buildRelationLine = (symbol: string, targetPath: string): string => {
    return `${symbol} [[${targetPath}]]`;
};

export const buildRemovalRegex = (symbol: string, targetPath: string): RegExp => {
    const escapedPath = targetPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(`^${symbol}\\s*\\[\\[${escapedPath}\\]\\]\\s*$\\r?\\n?`, 'm');
};
