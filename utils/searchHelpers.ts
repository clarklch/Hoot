/**
 * Fuzzy search utility function
 * Checks if a search term matches text, allowing for partial matches
 * where characters appear in order (not necessarily consecutively)
 * 
 * @param text - The text to search in
 * @param searchTerm - The search term to match
 * @returns boolean - True if the search term matches the text
 */
export function fuzzyMatch(text: string, searchTerm: string): boolean {
  if (!searchTerm.trim()) return true;

  const normalizedText = text.toLowerCase();
  const normalizedSearch = searchTerm.toLowerCase().trim();

  // Exact match
  if (normalizedText.includes(normalizedSearch)) return true;

  // Fuzzy match: check if all characters in search term appear in order in the text
  let searchIndex = 0;
  for (let i = 0; i < normalizedText.length && searchIndex < normalizedSearch.length; i++) {
    if (normalizedText[i] === normalizedSearch[searchIndex]) {
      searchIndex++;
    }
  }

  return searchIndex === normalizedSearch.length;
}

