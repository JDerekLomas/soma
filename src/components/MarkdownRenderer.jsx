import React, { useState, memo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Play, Code, ExternalLink } from 'lucide-react';

// Custom style overrides for syntax highlighter
const codeStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    margin: 0,
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
  },
};

// Copy button component
const CopyButton = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
      title="Copy code"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

// Code block component with syntax highlighting
const CodeBlock = ({ language, children, isArtifact, onRunArtifact }) => {
  const code = String(children).replace(/\n$/, '');

  return (
    <div className="relative group my-4">
      {/* Language badge */}
      <div className="flex items-center justify-between bg-gray-800 rounded-t-lg px-4 py-2 text-xs">
        <span className="text-gray-400 font-mono uppercase tracking-wide">
          {language || 'code'}
        </span>
        <div className="flex items-center gap-2">
          {isArtifact && (
            <button
              onClick={() => onRunArtifact(code, language)}
              className="flex items-center gap-1 px-2 py-1 bg-[#D97757] hover:bg-[#C06345] text-white rounded text-xs font-medium transition-colors"
            >
              <Play size={12} />
              Preview
            </button>
          )}
          <CopyButton code={code} />
        </div>
      </div>

      <SyntaxHighlighter
        style={codeStyle}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: '0.5rem',
          borderBottomRightRadius: '0.5rem',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

// Learning link component (for [[term::definition]] syntax)
// Clicking opens a Deep Dive tab with the definition as the initial summary
// Uses data attributes for event delegation to avoid stale closure issues
const LearningLink = memo(({ term, definition }) => {
  return (
    <span
      data-learning-link="true"
      data-term={term}
      data-definition={definition}
      className="inline-block border-b-2 cursor-pointer transition-all duration-200 hover:bg-orange-100 mx-[1px] px-[2px] rounded-[2px]"
      style={{
        borderColor: 'rgba(217, 119, 87, 0.4)',
        backgroundColor: 'rgba(217, 119, 87, 0.15)',
      }}
    >
      {term}
    </span>
  );
});

// Legacy learning chip component (for %%term%% syntax - backwards compatibility)
// Uses data attributes for event delegation to avoid stale closure issues
const LearningChip = memo(({ term }) => {
  return (
    <span
      data-learning-link="true"
      data-term={term}
      data-definition=""
      className="inline-block border-b-2 cursor-pointer transition-all duration-200 hover:bg-orange-100 mx-[1px] px-[2px] rounded-[2px]"
      style={{
        borderColor: 'rgba(217, 119, 87, 0.4)',
        backgroundColor: 'rgba(217, 119, 87, 0.15)',
      }}
    >
      {term}
    </span>
  );
});

// Process text with learning links [[term]] or [[term::definition]] and legacy %%term%% chips
// Note: Components use data attributes for event delegation, so no onClick is passed
const processChips = (text) => {
  if (typeof text !== 'string') return text;

  // Split on [[...]] or %%...%% patterns
  // Use [\s\S] instead of . to match across newlines, non-greedy
  const parts = text.split(/(\[\[[\s\S]+?\]\]|%%[^%]+%%)/g);

  return parts.map((part, i) => {
    // New syntax: [[term]] or [[term::definition]]
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const inner = part.slice(2, -2); // Remove [[ and ]]
      const separatorIndex = inner.indexOf('::');
      if (separatorIndex > 0) {
        // Has definition: [[term::definition]]
        const term = inner.slice(0, separatorIndex).trim();
        const definition = inner.slice(separatorIndex + 2).trim();
        if (term) {
          return <LearningLink key={`link-${term}-${i}`} term={term} definition={definition} />;
        }
      } else {
        // Simple format: [[term]]
        const term = inner.trim();
        if (term) {
          return <LearningLink key={`link-${term}-${i}`} term={term} definition="" />;
        }
      }
      // Fallback: return inner text
      return inner;
    }
    // Legacy syntax: %%term%%
    if (part.startsWith('%%') && part.endsWith('%%')) {
      const term = part.slice(2, -2);
      return <LearningChip key={`chip-${term}-${i}`} term={term} />;
    }
    return part;
  });
};

// Main MarkdownRenderer component
export default function MarkdownRenderer({
  content,
  onChipClick,
  onRunArtifact,
  isSerif = true
}) {
  const containerRef = useRef(null);

  // Artifact-capable languages
  const artifactLanguages = ['jsx', 'tsx', 'react', 'html'];

  // Event delegation for learning links - uses mousedown to fire immediately
  // before React can re-render during streaming
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onChipClick) return;

    const handleMouseDown = (e) => {
      // Find the learning link element (could be the target or an ancestor)
      const learningLink = e.target.closest('[data-learning-link="true"]');
      if (!learningLink) return;

      // Only handle left clicks
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      window.getSelection()?.removeAllRanges();

      const term = learningLink.getAttribute('data-term');
      const definition = learningLink.getAttribute('data-definition');

      if (term) {
        onChipClick(term, definition || '');
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    return () => container.removeEventListener('mousedown', handleMouseDown);
  }, [onChipClick]);

  return (
    <div
      ref={containerRef}
      className={`markdown-content ${isSerif ? 'font-serif' : 'font-sans'} leading-relaxed`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom code block rendering
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isArtifact = artifactLanguages.includes(language.toLowerCase());

            // Inline code
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 bg-gray-100 text-[#D97757] rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Code block
            return (
              <CodeBlock
                language={language}
                isArtifact={isArtifact}
                onRunArtifact={onRunArtifact}
              >
                {children}
              </CodeBlock>
            );
          },

          // Helper to process children recursively for chips
          // Note: processChips no longer needs onChipClick - we use event delegation
          ...(() => {
            const processChildren = (children) => {
              return React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return processChips(child);
                }
                if (React.isValidElement(child) && child.props?.children) {
                  return React.cloneElement(child, {
                    ...child.props,
                    children: processChildren(child.props.children)
                  });
                }
                return child;
              });
            };

            return {
              // Custom paragraph with chip support
              p({ children }) {
                return <p className="mb-4 last:mb-0">{processChildren(children)}</p>;
              },

              // Headings with chip support
              h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4">{processChildren(children)}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3">{processChildren(children)}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{processChildren(children)}</h3>,

              // Lists with chip support
              ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="ml-2">{processChildren(children)}</li>,

              // Strong/em with chip support
              strong: ({ children }) => <strong className="font-bold">{processChildren(children)}</strong>,
              em: ({ children }) => <em className="italic">{processChildren(children)}</em>,
            };
          })(),

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#D97757] pl-4 my-4 italic text-gray-600">
              {children}
            </blockquote>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D97757] hover:underline inline-flex items-center gap-1"
            >
              {children}
              <ExternalLink size={12} />
            </a>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 bg-gray-100 border border-gray-200 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 border border-gray-200">{children}</td>
          ),

          // Horizontal rule
          hr: () => <hr className="my-6 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
