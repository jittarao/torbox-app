/** Shared metadata builder for locale page shells. */
export function pageMetadata(title, description) {
  const fullTitle = title.includes('TorBox') ? title : `${title} — TorBox Manager`;
  return {
    title: fullTitle,
    description,
  };
}
