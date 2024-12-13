import { memo, useCallback, useMemo } from 'react';

const SearchInput = memo(({ onSearch }) => {
  const handleChange = useCallback((e) => {
    onSearch(e.target.value);
  }, [onSearch]);

  return (
    <input 
      type="text"
      onChange={handleChange}
      placeholder="Search..."
    />
  );
});

const SearchResults = memo(({ results }) => {
  const sortedResults = useMemo(() => {
    return results.sort((a, b) => b.relevance - a.relevance);
  }, [results]);

  return (
    <div>
      {sortedResults.map(result => (
        <div key={result.id}>{result.title}</div>
      ))}
    </div>
  );
}); 