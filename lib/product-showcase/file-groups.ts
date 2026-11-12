export const SHOWCASE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type NamedFile = {
  name: string;
};

export type BulkFileGroup<T extends NamedFile> = {
  id: string;
  name: string;
  files: Array<{ file: T; order: number }>;
};

function detailSortKey(name: string) {
  const stem = name.replace(/\.[^.]+$/, '');
  // 카카오톡은 원본 뒤에 _01, _02를 붙인다. 날짜·시각 숫자(_20261111, _171159362)는 순번이 아니다.
  const match = stem.match(/^(.*)_(\d{2})$/);
  if (!match) return { base: stem, order: 0 };
  return { base: match[1], order: Number(match[2]) };
}

export function sortDetailFiles<T extends NamedFile>(files: T[]) {
  return [...files].sort((a, b) => {
    const left = detailSortKey(a.name);
    const right = detailSortKey(b.name);
    const byBase = left.base.localeCompare(right.base, 'en', { numeric: true, sensitivity: 'base' });
    if (byBase !== 0) return byBase;
    if (left.order !== right.order) return left.order - right.order;
    return a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
  });
}

export function parseBulkFiles<T extends NamedFile>(files: T[]) {
  const groups = new Map<string, BulkFileGroup<T>>();
  const errors: string[] = [];

  files.forEach((file) => {
    const stem = file.name.replace(/\.[^.]+$/, '');
    const parts = stem.split('__');
    const id = parts[0]?.trim();
    const order = Number(parts[1]);
    const name = parts.slice(2).join('__').trim();
    if (!id || !SHOWCASE_ID_PATTERN.test(id) || !Number.isFinite(order) || order < 1 || !name) {
      errors.push(`${file.name}: 파일명 형식이 올바르지 않습니다.`);
      return;
    }
    const current = groups.get(id) || { id, name, files: [] };
    if (current.name !== name) {
      errors.push(`${file.name}: 같은 상품 ID에 서로 다른 상품명이 있습니다.`);
      return;
    }
    current.files.push({ file, order });
    groups.set(id, current);
  });

  return {
    groups: Array.from(groups.values())
      .map((group) => ({ ...group, files: group.files.sort((a, b) => a.order - b.order) }))
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    errors,
  };
}

export function isLooseDetailBatch(fileCount: number, groupCount: number, errorCount: number) {
  return fileCount > 0 && groupCount === 0 && errorCount === fileCount;
}
