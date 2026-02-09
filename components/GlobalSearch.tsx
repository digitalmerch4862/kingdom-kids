import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, X, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Student } from '../types';

interface GlobalSearchProps {
  students: Student[];
  studentsIndex: { id: string; fullName: string; ageGroup: string; searchText: string }[];
  onSelect: (student: Student) => void;
  placeholder?: string;
}

interface SearchResult {
  id: string;
  fullName: string;
  ageGroup: string;
  matchScore: number;
  highlights: number[];
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({
  students,
  studentsIndex,
  onSelect,
  placeholder = 'Search student by name or group...'
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fuzzySearch = useCallback((searchText: string, query: string): { score: number; matches: number[] } => {
    const normalizedQuery = query.toLowerCase().trim();
    const terms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
    
    if (terms.length === 0) return { score: 0, matches: [] };

    const lowerSearch = searchText.toLowerCase();
    let totalScore = 0;
    const allMatches: number[] = [];

    for (const term of terms) {
      let termScore = 0;
      let foundIndex = lowerSearch.indexOf(term);
      
      if (foundIndex !== -1) {
        if (foundIndex === 0 || lowerSearch[foundIndex - 1] === ' ') {
          termScore = 10;
        } else {
          termScore = 5;
        }

        const exactName = students.find(s => s.id === studentsIndex.find(si => si.searchText === searchText)?.id)?.fullName.toLowerCase() || '';
        if (exactName.startsWith(term)) {
          termScore += 15;
        }

        allMatches.push(foundIndex);
      }
      
      totalScore += termScore;
    }

    return { score: totalScore, matches: allMatches };
  }, [students, studentsIndex]);

  const filteredResults = useMemo(() => {
    if (!query.trim()) {
      return studentsIndex.slice(0, 5).map((s, idx) => ({
        ...s,
        matchScore: 100 - idx,
        highlights: [0]
      }));
    }

    const normalizedQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    for (const student of studentsIndex) {
      const { score, matches } = fuzzySearch(student.searchText, normalizedQuery);
      if (score > 0) {
        results.push({
          ...student,
          matchScore: score,
          highlights: matches
        });
      }
    }

    return results
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return a.fullName.localeCompare(b.fullName);
      })
      .slice(0, 10);
  }, [query, studentsIndex, fuzzySearch]);

  const getStudentById = (id: string): Student | undefined => {
    return students.find(s => s.id === id);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen && e.key !== 'Escape') {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        inputRef.current?.focus();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredResults[selectedIndex]) {
          const student = getStudentById(filteredResults[selectedIndex].id);
          if (student) {
            onSelect(student);
            setQuery('');
            setIsOpen(false);
            setIsExpanded(false);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, filteredResults, selectedIndex]);

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <span key={i} className="bg-yellow-200 font-bold">{part}</span> 
        : part
    );
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && filteredResults[selectedIndex]) {
      const selectedElement = document.getElementById(`search-result-${filteredResults[selectedIndex].id}`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, filteredResults, isOpen]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            if (query) setIsExpanded(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-12 pr-20 py-3 bg-white border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-200 text-sm font-medium transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={() => {
              setIsExpanded(!isExpanded);
              setIsOpen(!isOpen);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {(isOpen || isExpanded) && filteredResults.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white border border-pink-100 rounded-xl shadow-xl overflow-hidden"
          style={{ maxHeight: isExpanded ? '400px' : 'auto' }}
        >
          <div className={isExpanded ? 'overflow-y-auto max-h-[400px]' : ''}>
            {filteredResults.map((result, index) => {
              const student = getStudentById(result.id);
              if (!student) return null;

              return (
                <button
                  id={`search-result-${result.id}`}
                  key={result.id}
                  onClick={() => {
                    onSelect(student);
                    setQuery('');
                    setIsOpen(false);
                    setIsExpanded(false);
                  }}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                    index === selectedIndex ? 'bg-pink-50' : 'hover:bg-gray-50'
                  } ${index < 5 || isExpanded ? '' : 'hidden'}`}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {student.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">
                      {highlightText(student.fullName, query)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Users size={12} />
                      <span>{student.ageGroup} Group</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {index === selectedIndex && (
                      <span className="text-xs text-pink-500 font-medium px-2 py-1 bg-pink-100 rounded">Enter</span>
                    )}
                    {index < 3 && (
                      <span className="text-xs text-gray-300 font-bold">#{index + 1}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          
          {isExpanded && filteredResults.length > 5 && (
            <div className="px-4 py-2 bg-gray-50 text-center text-xs text-gray-400 font-medium border-t border-gray-100">
              {filteredResults.length} results found
            </div>
          )}
        </div>
      )}

      {isOpen && query && filteredResults.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-pink-100 rounded-xl shadow-xl p-4 text-center">
          <p className="text-gray-400 text-sm">No students found matching "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
