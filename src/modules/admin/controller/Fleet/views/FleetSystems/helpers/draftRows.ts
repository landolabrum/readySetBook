// Shared shape for the config draft-table editors (app_env, secrets): turn a
// JSONB object into a stable, key-sorted list of rows via a per-editor builder.
export const objToSortedRows = <T extends { key: string }>(
    obj: any,
    build: (key: string, value: any) => T,
): T[] => {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj)
        .map(([key, value]) => build(key, value))
        .sort((a, b) => a.key.localeCompare(b.key));
};
