import React from 'react';

/**
 * Renders plain text with inline `backtick` segments wrapped in semantic <code> elements.
 */
export function renderFormattedText(text: string): React.ReactNode {
  if (!text.includes('`')) {
    return text;
  }

  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.length >= 2 && part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}
