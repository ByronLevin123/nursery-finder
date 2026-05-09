export function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&')
}
