import React, { useState, useRef, useEffect } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
} from '@codesandbox/sandpack-react';
import { X, Code, Eye, Maximize2, Minimize2, RotateCcw } from 'lucide-react';

// Sandpack theme matching Claude Tabs design
const claudeTheme = {
  colors: {
    surface1: '#1C1C1A',
    surface2: '#2D2D2A',
    surface3: '#3D3D3A',
    clickable: '#999999',
    base: '#FFFFFF',
    disabled: '#4D4D4D',
    hover: '#D97757',
    accent: '#D97757',
    error: '#ff453a',
    errorSurface: '#ffeceb',
  },
  syntax: {
    plain: '#FFFFFF',
    comment: { color: '#757575', fontStyle: 'italic' },
    keyword: '#D97757',
    tag: '#D97757',
    punctuation: '#FFFFFF',
    definition: '#82AAFF',
    property: '#82AAFF',
    static: '#FF5370',
    string: '#C3E88D',
  },
  font: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"Fira Code", "Fira Mono", Menlo, Consolas, monospace',
    size: '14px',
    lineHeight: '1.6',
  },
};

// Wrap code in a React component if it's just JSX
const wrapCode = (code, language) => {
  // If it looks like a complete component, use as-is
  if (code.includes('export default') || code.includes('function App')) {
    return code;
  }

  // If it's HTML, wrap in a simple component
  if (language === 'html') {
    return `export default function App() {
  return (
    <div dangerouslySetInnerHTML={{ __html: \`${code.replace(/`/g, '\\`')}\` }} />
  );
}`;
  }

  // Wrap JSX in a component
  return `export default function App() {
  return (
    <>
      ${code}
    </>
  );
}`;
};

// Dependencies available in the sandbox
const SANDBOX_DEPENDENCIES = {
  "lucide-react": "0.263.1",
  "recharts": "2.5.0",
  "framer-motion": "10.16.0",
  "date-fns": "2.30.0",
  "lodash": "4.17.21",
  "mathjs": "11.8.0"
};

export default function ArtifactPreview({
  code,
  language = 'jsx',
  title = 'Preview',
  onClose
}) {
  const [view, setView] = useState('preview'); // 'preview' | 'code' | 'split'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0); // For forcing re-render
  const [sandpackHeight, setSandpackHeight] = useState(400); // Default height
  const containerRef = useRef(null);

  // Measure available height for Sandpack
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const headerHeight = 40; // ArtifactPreview header
        const availableHeight = containerHeight - headerHeight;
        setSandpackHeight(Math.max(availableHeight, 200)); // Minimum 200px
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    // Also update after a short delay to catch layout changes
    const timeout = setTimeout(updateHeight, 100);

    return () => {
      window.removeEventListener('resize', updateHeight);
      clearTimeout(timeout);
    };
  }, [isFullscreen]);

  const wrappedCode = wrapCode(code, language);

  const files = {
    '/App.js': wrappedCode,
    '/styles.css': `
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 1rem;
  background: #FAF9F6;
  color: #2D2D2A;
}
    `.trim(),
  };

  // When fullscreen, use viewport height. Otherwise, fill parent container (100%)
  const containerClass = isFullscreen
    ? 'fixed inset-0 z-[100] bg-white flex flex-col'
    : 'h-full flex flex-col rounded-xl overflow-hidden border border-[#E6E4DD] shadow-lg bg-white';

  return (
    <div ref={containerRef} className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between bg-[#1C1C1A] px-4 py-2 text-white">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm font-medium text-gray-300">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggles */}
          <div className="flex bg-gray-800 rounded-md p-0.5">
            <button
              onClick={() => setView('code')}
              className={`p-1.5 rounded transition-colors ${
                view === 'code' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Code view"
            >
              <Code size={14} />
            </button>
            <button
              onClick={() => setView('split')}
              className={`p-1.5 rounded transition-colors ${
                view === 'split' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Split view"
            >
              <div className="flex gap-0.5">
                <Code size={10} />
                <Eye size={10} />
              </div>
            </button>
            <button
              onClick={() => setView('preview')}
              className={`p-1.5 rounded transition-colors ${
                view === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Preview view"
            >
              <Eye size={14} />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => setKey(k => k + 1)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Refresh preview"
          >
            <RotateCcw size={14} />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Sandpack - use measured height in pixels for reliable iframe sizing */}
      <div style={{ height: `${sandpackHeight}px`, flexShrink: 0 }}>
        <SandpackProvider
          key={key}
          template="react"
          theme={claudeTheme}
          files={files}
          customSetup={{
            dependencies: SANDBOX_DEPENDENCIES
          }}
          options={{
            externalResources: [
              'https://cdn.tailwindcss.com',
            ],
          }}
        >
          <SandpackLayout
            style={{
              height: `${sandpackHeight}px`,
              border: 'none',
            }}
          >
            {(view === 'code' || view === 'split') && (
              <SandpackCodeEditor
                style={{
                  height: `${sandpackHeight}px`,
                  flex: view === 'split' ? 1 : 2,
                }}
                showLineNumbers
                showTabs={false}
              />
            )}
            {(view === 'preview' || view === 'split') && (
              <SandpackPreview
                style={{
                  height: `${sandpackHeight}px`,
                  flex: 1,
                }}
                showOpenInCodeSandbox={false}
                showRefreshButton={false}
              />
            )}
          </SandpackLayout>
        </SandpackProvider>
      </div>
    </div>
  );
}
