import React, { useEffect, useRef, useState } from 'react';
import { Quote } from '../types';
import { Share2, Bookmark, BookmarkCheck, Copy, PenLine, ChevronLeft, ChevronRight, Dices, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface QuoteCardProps {
  quoteData: Quote;
  date: Date;
  isSaved: boolean;
  onToggleSave: () => void;
  hasNote?: boolean;
  onOpenNote: () => void;
  
  // New props for navigation modes
  mode: 'daily' | 'random' | 'book';
  onPrev?: () => void;
  onNext?: () => void;
  onRandom?: () => void;
}

export const QuoteCard: React.FC<QuoteCardProps> = ({ 
  quoteData, 
  date, 
  isSaved, 
  onToggleSave, 
  hasNote, 
  onOpenNote,
  mode,
  onPrev,
  onNext,
  onRandom
}) => {
  const [copied, setCopied] = React.useState(false);
  const [isSharing, setIsSharing] = React.useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Swipe logic refs
  const touchStartX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  // Keyboard Navigation
  useEffect(() => {
    if (mode !== 'book') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, onPrev, onNext]);

  // Swipe Handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const distance = touchStartX.current - touchEndX;
    
    if (mode === 'book') {
        if (distance > minSwipeDistance && onNext) {
          onNext(); // Swipe Left -> Next Page
        } else if (distance < -minSwipeDistance && onPrev) {
          onPrev(); // Swipe Right -> Prev Page
        }
    }
    touchStartX.current = null;
  };

  const handleCopy = () => {
    const textToCopy = `"${quoteData.quote}"\n\n- 하루 한장, 역설의 가르침 365 (${date.toLocaleDateString()})`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsSharing(true);

    try {
      // 1. Capture the card as a canvas
      // scale: 2 improves resolution for high DPI screens
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#faf9f6', // Ensure background color is captured
        useCORS: true, // Needed for external images (if any)
      });

      // 2. Convert canvas to Blob
      const blob = await new Promise<Blob | null>((resolve) => 
        canvas.toBlob(resolve, 'image/png')
      );

      if (!blob) throw new Error('Failed to generate image');

      // 3. Create a File object
      const file = new File([blob], 'quote_card.png', { type: 'image/png' });

      // 4. Share using Web Share API if supported
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '하루 한장, 역설의 가르침 365',
          text: '오늘의 명언을 공유합니다.',
        });
      } else {
        // Fallback for PC or browsers that don't support file sharing: Download the image
        const link = document.createElement('a');
        link.download = `quote_${date.getMonth() + 1}_${date.getDate()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (err) {
      console.error('Error sharing image:', err);
      // Fallback to text copy if image generation fails
      handleCopy();
    } finally {
      setIsSharing(false);
    }
  };

  const monthName = date.toLocaleDateString('en-US', { month: 'long' });
  const dayNumber = date.getDate();

  return (
    <div className="w-full flex justify-center items-center animate-slide-up perspective-1000 relative">
      
      {/* Card Container */}
      {/* Mobile optimization: Reduced max-w to 330px to ensure height fits on screen (since aspect ratio is fixed) */}
      <div 
        ref={cardRef}
        className="bg-[#faf9f6] relative rounded shadow-xl border-l-2 border-l-gray-200 border-r border-gray-100 overflow-hidden w-full max-w-[330px] md:max-w-[380px] aspect-[4/5] flex flex-col select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        
        {/* Paper Texture Effect */}
        <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-multiply" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E")` }}>
        </div>

        {/* Floating Navigation Buttons (Book Mode Only) - Unified for ALL devices */}
        {/* Added data-html2canvas-ignore to hide navigation arrows in shared image */}
        {mode === 'book' && (
            <div data-html2canvas-ignore="true">
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPrev && onPrev(); }}
                    className="absolute left-1 top-1/2 -translate-y-1/2 z-20 p-2 outline-none focus:outline-none opacity-50 hover:opacity-100 transition-opacity"
                    aria-label="Previous Page"
                >
                    <div className="bg-white/60 backdrop-blur-[2px] p-2 rounded-full shadow-sm border border-gray-200/50 hover:bg-white transition-colors">
                        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
                    </div>
                </button>
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onNext && onNext(); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 z-20 p-2 outline-none focus:outline-none opacity-50 hover:opacity-100 transition-opacity"
                    aria-label="Next Page"
                >
                     <div className="bg-white/60 backdrop-blur-[2px] p-2 rounded-full shadow-sm border border-gray-200/50 hover:bg-white transition-colors">
                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
                    </div>
                </button>
            </div>
        )}

        {/* Inner Frame - Tighter inset on mobile */}
        <div className="absolute inset-4 md:inset-6 border-[0.5px] border-[#dcdcdc] flex flex-col items-center justify-between py-6 md:py-10 px-4 z-10">
            
            {/* Top Corner Ornaments */}
            <div className="absolute top-1 left-1 w-2 h-2 md:w-3 md:h-3 border-t border-l border-[#dcdcdc]"></div>
            <div className="absolute top-1 right-1 w-2 h-2 md:w-3 md:h-3 border-t border-r border-[#dcdcdc]"></div>
            <div className="absolute bottom-1 left-1 w-2 h-2 md:w-3 md:h-3 border-b border-l border-[#dcdcdc]"></div>
            <div className="absolute bottom-1 right-1 w-2 h-2 md:w-3 md:h-3 border-b border-r border-[#dcdcdc]"></div>

            {/* Header Section: Date */}
            <div className="flex flex-col items-center space-y-1 md:space-y-3 mt-1 md:mt-2">
                <span className="font-serif text-[#7a7a7a] text-sm md:text-lg tracking-[0.2em] uppercase border-b-[0.5px] border-[#dcdcdc] pb-1 md:pb-2 min-w-[60px] md:min-w-[80px] text-center text-ink">
                    {monthName}
                </span>
                <span className="font-serif text-[#2d3436] text-4xl md:text-5xl pt-1 text-ink font-normal">
                    {dayNumber}
                </span>
            </div>

            {/* Middle Section: Ornament & Quote */}
            {/* Reduced vertical spacing for mobile compactness */}
            <div className="flex flex-col items-center justify-center flex-grow w-full space-y-4 md:space-y-8">
                {/* Decorative Ornament */}
                <div className="w-6 md:w-8 h-px bg-[#dcdcdc]"></div>

                {/* The Quote */}
                <div className="w-full text-center px-1">
                    <h1 className="text-lg md:text-2xl font-serif text-[#1a1a1a] leading-snug whitespace-pre-wrap break-keep text-ink font-normal">
                        {quoteData.quote}
                    </h1>
                </div>
                
                 {/* Decorative Ornament */}
                 <div className="w-6 md:w-8 h-px bg-[#dcdcdc]"></div>
            </div>

            {/* Bottom Section: Actions */}
            {/* Added data-html2canvas-ignore to hide this section in the generated image */}
            <div className="flex items-center justify-center gap-6 md:gap-8 pt-3 md:pt-6 text-[#9a9a9a] w-full" data-html2canvas-ignore="true">
                
                {/* Note Button */}
                <button 
                    onClick={onOpenNote}
                    className="hover:text-[#5a5a5a] transition-colors p-1.5 md:p-2 relative group"
                    title="나의 단상 기록하기"
                >
                     <PenLine className={`w-5 h-5 ${hasNote ? 'text-[#c45d3d] stroke-[2px]' : ''}`} />
                     {hasNote && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#c45d3d] rounded-full"></span>}
                </button>

                {/* Save Button */}
                <button 
                    onClick={onToggleSave}
                    className="hover:text-[#c45d3d] transition-colors p-1.5 md:p-2"
                    title={isSaved ? "저장 취소" : "보관함에 저장"}
                >
                    {isSaved ? <BookmarkCheck className="w-5 h-5 text-[#c45d3d]" /> : <Bookmark className="w-5 h-5" />}
                </button>
                
                {/* Copy Button */}
                <button 
                    onClick={handleCopy}
                    className="hover:text-[#5a5a5a] transition-colors p-1.5 md:p-2 relative group"
                    title="텍스트 복사"
                >
                    <Copy className="w-5 h-5" />
                    {copied && <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-2 py-1 rounded font-sans whitespace-nowrap z-50">복사됨</span>}
                </button>

                {/* Random Shuffle Button - Highlighted in Dark Color for Random Mode */}
                {mode === 'random' && (
                  <button 
                    onClick={onRandom}
                    className="text-[#1a1a1a] hover:opacity-70 transition-opacity p-1.5 md:p-2"
                    title="다른 명언 뽑기"
                  >
                    <Dices className="w-5 h-5" />
                  </button>
                )}

                {/* Share Button */}
                <button 
                    onClick={handleShare}
                    className="hover:text-[#5a5a5a] transition-colors p-1.5 md:p-2 disabled:opacity-50"
                    title="이미지로 공유하기"
                    disabled={isSharing}
                >
                    {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                </button>
            </div>

        </div>
      </div>
    </div>
  );
};