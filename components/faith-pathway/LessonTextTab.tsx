import React, { useMemo, useEffect, useState, useRef } from 'react';
import { parseContent } from '../../utils/lessonMarkdown';

interface LessonTextTabProps {
  content: string;
  activeReadingId?: string | null;
  onActiveIdChange?: (id: string | null) => void;
  isPlaying?: boolean;
}

const getIcon = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes('bible') || t.includes('read') || t.includes('text')) {
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
};

const LessonTextTab: React.FC<LessonTextTabProps> = ({
  content,
  activeReadingId,
  onActiveIdChange,
  isPlaying = false,
}) => {
  const sections = useMemo(() => parseContent(content), [content]);
  const [isManualScroll, setIsManualScroll] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!isPlaying || isManualScroll) {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              onActiveIdChange?.(entry.target.id);
            }
          });
        }
      },
      { threshold: 0.5 }
    );
    document.querySelectorAll('[data-segment-card]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isPlaying, isManualScroll, onActiveIdChange]);

  useEffect(() => {
    const handleScroll = () => {
      setIsManualScroll(true);
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(() => setIsManualScroll(false), 1500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const renderFormattedContent = (text: string) =>
    text.split('\n\n').map((para, i) => (
      <p key={i} className="mb-6 leading-relaxed text-gray-800">{para}</p>
    ));

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {sections.map((section) => (
        <div key={section.id} id={section.id} className="scroll-mt-32">
          <div className="flex items-center gap-6 mb-10">
            <h2 className="shrink-0 text-sm font-black uppercase tracking-[0.3em] text-[#EF4E92]">
              {section.title}
            </h2>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="space-y-6">
            {section.subsections.map((sub) => {
              const isActive = activeReadingId === sub.id;
              return (
                <div
                  key={sub.id}
                  id={sub.id}
                  data-segment-card
                  className={`bg-white rounded-[32px] p-6 md:p-10 shadow-sm border-t-[8px] scroll-mt-32 transition-all duration-700 ${
                    isActive
                      ? 'scale-[1.02] ring-4 ring-[#EF4E92]/30 shadow-2xl border-t-[#EF4E92] bg-pink-50/10'
                      : 'hover:shadow-xl'
                  }`}
                  style={{ borderTopColor: '#EF4E92', transform: isActive ? 'translateY(-4px)' : 'none' }}
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      isActive ? 'bg-[#EF4E92] text-white scale-110 rotate-3' : 'bg-pink-50 text-[#EF4E92]'
                    }`}>
                      {getIcon(sub.title)}
                    </div>
                    <h3 className={`text-2xl font-black tracking-tight transition-colors ${isActive ? 'text-[#EF4E92]' : 'text-gray-900'}`}>
                      {sub.title}
                    </h3>
                  </div>
                  <div className="text-lg md:text-xl font-serif text-gray-800 leading-relaxed selection:bg-pink-100">
                    {renderFormattedContent(sub.content)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LessonTextTab;
