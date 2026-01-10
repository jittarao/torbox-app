'use client';

/**
 * TagDisplay component - displays tags as chips/badges
 * @param {Object} props
 * @param {Array} props.tags - Array of tag objects { id, name }
 * @param {Function} props.onTagClick - Optional callback when tag is clicked
 * @param {string} props.className - Additional CSS classes
 */
export default function TagDisplay({ tags = [], onTagClick, className = '' }) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-row gap-1.5 ${className}`}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          onClick={() => onTagClick && onTagClick(tag)}
          className={`
            inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md
            bg-accent/10 dark:bg-accent-dark/10
            text-accent dark:text-accent-dark
            border border-accent/20 dark:border-accent-dark/20
            ${onTagClick ? 'cursor-pointer hover:bg-accent/20 dark:hover:bg-accent-dark/20 transition-colors' : ''}
          `}
          title={onTagClick ? `Filter by ${tag.name}` : tag.name}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}
