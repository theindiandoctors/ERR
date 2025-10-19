
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    SparklesIcon, ChevronDownIcon, BoldIcon, ItalicIcon, UnderlineIcon, 
    ListBulletIcon, HeadingIcon, ListOrderedIcon
} from '../../assets/icons';
import { generateText } from '../../services/geminiService';
import { LoadingSpinner } from './LoadingSpinner';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const AIActions = [
    { id: 'improve', label: 'Improve Writing', prompt: 'Rewrite the following text, improving its clarity, flow, and impact. Return only the improved text.' },
    { id: 'professional', label: 'Make Professional', prompt: 'Rewrite the following text to have a more professional and academic tone. Return only the rewritten text.' },
    { id: 'shorten', label: 'Shorten', prompt: 'Concisely summarize or shorten the following text while preserving its core meaning. Return only the rewritten text.' },
    { id: 'expand', label: 'Expand', prompt: 'Expand on the following text, adding more detail, explanation, or examples to elaborate on the ideas. Return only the expanded text.' },
];

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, disabled = false, className = '' }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
  const lastSelection = useRef<Range | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && value !== editor.innerHTML) {
      editor.innerHTML = value;
    }
  }, [value]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
      onChange(e.currentTarget.innerHTML);
  }, [onChange]);

  const formatDoc = (command: string, value?: string) => {
    if (disabled) return;
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    onChange(editorRef.current?.innerHTML || '');
  };
  
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      lastSelection.current = selection.getRangeAt(0).cloneRange();
    }
  };
  
  const restoreSelection = () => {
    if (lastSelection.current) {
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(lastSelection.current);
        }
    }
  };

  const handleAiAction = async (action: { id: string; label: string; prompt: string }) => {
    setIsAiMenuOpen(false);
    if (disabled || !editorRef.current) return;
    
    saveSelection();
    
    let textToTransform = lastSelection.current ? lastSelection.current.toString() : editorRef.current.innerText;

    if (!textToTransform.trim()) {
        setAiError("Please select text or write something to use AI suggestions.");
        setTimeout(() => setAiError(null), 3000);
        return;
    }

    setIsAiLoading(true);
    setAiError(null);

    const fullPrompt = `${action.prompt}\n\nTEXT:\n"""\n${textToTransform}\n"""`;
    const response = await generateText(fullPrompt);

    if (response.text && !response.error) {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand('insertHTML', false, response.text.trim());
      onChange(editorRef.current?.innerHTML || '');
    } else {
      setAiError(response.error || 'An unknown error occurred.');
    }
    setIsAiLoading(false);
  };
  
  const handleStyleChange = (style: string) => {
    formatDoc('formatBlock', `<${style}>`);
    setIsStyleMenuOpen(false);
  };

  return (
    <div className={`border rounded-lg shadow-sm w-full bg-white ${disabled ? 'bg-gray-100 opacity-70' : 'border-gray-300 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500'} ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-wrap gap-1">
        {/* Style Dropdown */}
        <div className="relative">
          <button onClick={() => setIsStyleMenuOpen(s => !s)} disabled={disabled} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center">
            Styles <ChevronDownIcon className="w-4 h-4 ml-1"/>
          </button>
          {isStyleMenuOpen && (
            <div className="absolute z-10 mt-1 w-32 bg-white rounded-md shadow-lg border">
              <a onClick={() => handleStyleChange('p')} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Paragraph</a>
              <a onClick={() => handleStyleChange('h2')} className="block px-3 py-2 text-lg font-bold text-gray-700 hover:bg-gray-100 cursor-pointer">Heading 1</a>
              <a onClick={() => handleStyleChange('h3')} className="block px-3 py-2 text-md font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer">Heading 2</a>
            </div>
          )}
        </div>
        <div className="h-5 w-px bg-gray-300 mx-2"></div>
        {/* Formatting Buttons */}
        <button onClick={() => formatDoc('bold')} title="Bold" disabled={disabled} className="p-2 rounded hover:bg-gray-200"><BoldIcon className="w-5 h-5"/></button>
        <button onClick={() => formatDoc('italic')} title="Italic" disabled={disabled} className="p-2 rounded hover:bg-gray-200"><ItalicIcon className="w-5 h-5"/></button>
        <button onClick={() => formatDoc('underline')} title="Underline" disabled={disabled} className="p-2 rounded hover:bg-gray-200"><UnderlineIcon className="w-5 h-5"/></button>
        <div className="h-5 w-px bg-gray-300 mx-2"></div>
        <button onClick={() => formatDoc('insertUnorderedList')} title="Bulleted List" disabled={disabled} className="p-2 rounded hover:bg-gray-200"><ListBulletIcon className="w-5 h-5"/></button>
        <button onClick={() => formatDoc('insertOrderedList')} title="Numbered List" disabled={disabled} className="p-2 rounded hover:bg-gray-200"><ListOrderedIcon className="w-5 h-5"/></button>
        <div className="h-5 w-px bg-gray-300 mx-2"></div>
        {/* AI Suggestions Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsAiMenuOpen(o => !o)}
            disabled={disabled || isAiLoading}
            className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600 disabled:bg-primary-300"
          >
            {isAiLoading ? <LoadingSpinner size="sm" className="mr-2"/> : <SparklesIcon className="w-4 h-4 mr-1.5"/>}
            AI Suggestions
            <ChevronDownIcon className="w-4 h-4 ml-1"/>
          </button>
          {isAiMenuOpen && (
            <div className="absolute z-10 right-0 mt-1 w-48 bg-white rounded-md shadow-lg border">
              {AIActions.map(action => (
                <a key={action.id} onClick={() => handleAiAction(action)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">{action.label}</a>
              ))}
            </div>
          )}
        </div>
      </div>
      {aiError && <p className="text-xs text-red-600 p-2">{aiError}</p>}
      {/* Editor Area */}
      <div
        ref={editorRef}
        onInput={handleInput}
        contentEditable={!disabled}
        className="w-full p-4 prose max-w-none prose-sm focus:outline-none min-h-[300px] overflow-y-auto"
        data-placeholder={placeholder}
        style={{ minHeight: '300px' }} // Fallback height
        onFocus={saveSelection}
        onBlur={saveSelection}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
      ></div>
    </div>
  );
};
