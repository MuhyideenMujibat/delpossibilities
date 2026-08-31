export function paginate(items, page, pageSize) {
  return items.slice((page - 1) * pageSize, page * pageSize)
}
