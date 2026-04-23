/** Ordenação dentro da mesma categoria (o que o up/down no Bar grava em `sort_order`). */
export function compareMenuItemsInCategory(
  a: { sort_order?: number | null; name: string },
  b: { sort_order?: number | null; name: string }
): number {
  const sa = Number(a.sort_order) || 0;
  const sb = Number(b.sort_order) || 0;
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, 'pt');
}

type ItemWithCat = { id: string; category_id: string; sort_order?: number | null; name: string };

/**
 * Categorias na ordem a mostrar; itens de cada categoria por sort_order+name.
 * Itens sem categoria na lista ficam no fim, ordenados por compare.
 */
export function orderMenuItemsByCategoryList<T extends ItemWithCat>(
  categoriesOrdered: { id: string }[],
  items: T[]
): T[] {
  const byCat = new Map<string, T[]>();
  for (const it of items) {
    if (!byCat.has(it.category_id)) byCat.set(it.category_id, []);
    byCat.get(it.category_id)!.push(it);
  }
  for (const list of byCat.values()) {
    list.sort(compareMenuItemsInCategory);
  }
  const out: T[] = [];
  const used = new Set<string>();
  for (const c of categoriesOrdered) {
    for (const it of byCat.get(c.id) ?? []) {
      out.push(it);
      used.add(it.id);
    }
  }
  if (used.size < items.length) {
    out.push(
      ...items
        .filter((it) => !used.has(it.id))
        .sort(compareMenuItemsInCategory)
    );
  }
  return out;
}
