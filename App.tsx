import React, { useState, useEffect } from 'react';
import { Quote, StoredQuote } from './types';
import { generateQuoteOfDay, getRandomQuoteKey } from './services/geminiService';
import { FIXED_QUOTES } from './services/quotesData';
import { QuoteCard } from './components/QuoteCard';
import { Loader2, BookOpen, Star, X, List, Calendar, PenLine, Save, Shuffle, Book, NotebookPen } from 'lucide-react';

// Helper to get day of year (1-366)
const getDayOfYear = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};

// Helper to parse "M/D" string into a Date object for the current year
const getDateFromKey = (key: string): Date => {
  const [month, day] = key.split('/').map(Number);
  const date = new Date();
  date.setMonth(month - 1);
  date.setDate(day);
  return date;
};

// Update keys to force fresh load with new UI logic
const TODAY_KEY = 'today_quote_date_v4';
const TODAY_DATA_KEY = 'today_quote_data_v4';
const FAVORITES_KEY = 'favorite_quotes_v2';
const NOTES_KEY = 'user_notes_v1';
const BOOKMARK_KEY = 'last_read_page_v1'; // To store the last read date key

// Regex to identify the auto-added date signature
const DATE_SIGNATURE_REGEX = /\n\n — \d{4}\. \d{1,2}\. \d{1,2}\.$/;

type ViewMode = 'main' | 'favorites' | 'list' | 'notes';
type ReadingMode = 'daily' | 'random' | 'book';

const App: React.FC = () => {
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<StoredQuote[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({}); // Key: "YYYY-MM-DD", Value: Note text
  
  // Navigation & State
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [readingMode, setReadingMode] = useState<ReadingMode>('daily');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  
  // Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Install Hint State
  const [showInstallHint, setShowInstallHint] = useState(true);
  const [bookCoverError, setBookCoverError] = useState(false);
  
  const today = new Date();
  // Timezone correction for local date string
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = getLocalDateString(today);

  // Load favorites and notes on mount
  useEffect(() => {
    const storedFavs = localStorage.getItem(FAVORITES_KEY);
    if (storedFavs) {
      setFavorites(JSON.parse(storedFavs));
    }
    const storedNotes = localStorage.getItem(NOTES_KEY);
    if (storedNotes) {
      setNotes(JSON.parse(storedNotes));
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Fetch or Load Quote based on Date Object
  const loadQuoteByDate = async (targetDate: Date, forceRefresh = false) => {
    setLoading(true);
    
    // Create a unique cache key for this specific date
    const cacheKey = `quote_cache_v5_${targetDate.getMonth() + 1}_${targetDate.getDate()}`;
    const cachedData = localStorage.getItem(cacheKey);

    // Check fixed data first (PRIORITY)
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    const dateKey = `${month}/${day}`;
    
    // Always prioritize loaded fixed data over cache
    if (FIXED_QUOTES[dateKey]) {
         const fixedQuote: Quote = {
            quote: FIXED_QUOTES[dateKey],
            author: "",
            meaning: "",
            tags: []
         };
         setCurrentQuote(fixedQuote);
         setSelectedDateKey(dateKey); // Sync state
         setLoading(false);
         localStorage.setItem(cacheKey, JSON.stringify(fixedQuote));
         return;
    }

    if (!forceRefresh && cachedData) {
      setCurrentQuote(JSON.parse(cachedData));
      setSelectedDateKey(dateKey);
      setLoading(false);
      return;
    }

    try {
      const quote = await generateQuoteOfDay(targetDate);
      setCurrentQuote(quote);
      setSelectedDateKey(dateKey);
      localStorage.setItem(cacheKey, JSON.stringify(quote));
    } catch (error) {
      console.error("Error fetching quote:", error);
    } finally {
      setLoading(false);
    }
  };

  // Switch between Reading Modes
  const handleModeChange = (mode: ReadingMode) => {
    setReadingMode(mode);
    setViewMode('main');
    setLoading(true);

    if (mode === 'daily') {
      loadQuoteByDate(new Date());
    } else if (mode === 'random') {
      loadRandomQuote();
    } else if (mode === 'book') {
      loadBookMark();
    }
  };

  // --- Random Mode Logic ---
  const loadRandomQuote = () => {
    const randomKey = getRandomQuoteKey();
    const targetDate = getDateFromKey(randomKey);
    loadQuoteByDate(targetDate);
  };

  // --- Book Mode Logic (Sequential) ---
  const loadBookMark = () => {
    // 1. Try to get saved bookmark
    const savedKey = localStorage.getItem(BOOKMARK_KEY);
    // 2. Default to Jan 1st if no bookmark
    const targetKey = savedKey || "1/1";
    const targetDate = getDateFromKey(targetKey);
    loadQuoteByDate(targetDate);
  };

  const handleBookNavigate = (direction: 'next' | 'prev') => {
    if (!selectedDateKey) return;

    const currentDate = getDateFromKey(selectedDateKey);
    const nextDate = new Date(currentDate);
    
    if (direction === 'next') {
      nextDate.setDate(currentDate.getDate() + 1);
    } else {
      nextDate.setDate(currentDate.getDate() - 1);
    }

    const nextKey = `${nextDate.getMonth() + 1}/${nextDate.getDate()}`;
    
    // Save as bookmark
    localStorage.setItem(BOOKMARK_KEY, nextKey);
    
    loadQuoteByDate(nextDate);
  };

  // Initial Load (Today)
  useEffect(() => {
    loadQuoteByDate(today);
  }, []);

  // Handle List Selection
  const handleDateSelect = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    const targetDate = getDateFromKey(dateKey);
    loadQuoteByDate(targetDate);
    setViewMode('main');
    setReadingMode('daily'); 
  };

  const toggleFavorite = () => {
    if (!currentQuote) return;
    
    const isSaved = favorites.some(f => f.data.quote === currentQuote.quote);
    let newFavorites;
    
    if (isSaved) {
      newFavorites = favorites.filter(f => f.data.quote !== currentQuote.quote);
      showToast("보관함에서 삭제되었습니다.");
    } else {
      const newFavorite: StoredQuote = {
        data: currentQuote,
        date: selectedDateKey ? getLocalDateString(getDateFromKey(selectedDateKey)) : todayStr,
        viewedAt: Date.now()
      };
      newFavorites = [...favorites, newFavorite];
      showToast("보관함에 저장되었습니다.");
    }
    
    setFavorites(newFavorites);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
  };
  
  const isCurrentSaved = currentQuote ? favorites.some(f => f.data.quote === currentQuote.quote) : false;

  // Note Handling
  const displayDate = selectedDateKey ? getDateFromKey(selectedDateKey) : today;
  const currentNoteDateKey = getLocalDateString(displayDate);

  const handleOpenNote = () => {
    let text = notes[currentNoteDateKey] || '';
    // Strip the auto-added date signature for editing so user sees only their text
    text = text.replace(DATE_SIGNATURE_REGEX, '');
    setNoteText(text);
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) {
        const newNotes = { ...notes };
        delete newNotes[currentNoteDateKey];
        setNotes(newNotes);
        localStorage.setItem(NOTES_KEY, JSON.stringify(newNotes));
        showToast("메모가 삭제되었습니다.");
        setIsNoteModalOpen(false);
        return;
    }

    // Automatically append today's date as a signature
    const now = new Date();
    const signature = `\n\n — ${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;
    const textToSave = noteText.trim() + signature;

    const newNotes = { ...notes, [currentNoteDateKey]: textToSave };
    
    showToast("메모가 저장되었습니다.");
    setNotes(newNotes);
    localStorage.setItem(NOTES_KEY, JSON.stringify(newNotes));
    setIsNoteModalOpen(false);
  };

  const sortedQuotesList = Object.entries(FIXED_QUOTES).sort((a, b) => {
    const dateA = getDateFromKey(a[0]);
    const dateB = getDateFromKey(b[0]);
    return dateA.getTime() - dateB.getTime();
  });

  const sortedNotesList = Object.entries(notes).sort((a, b) => {
    return new Date(b[0]).getTime() - new Date(a[0]).getTime();
  });

  return (
    <div className="min-h-screen bg-[#e3e1db] font-sans text-gray-900 relative flex flex-col">
      <header className="px-4 py-2 sticky top-0 z-50 bg-[#e3e1db]/95 backdrop-blur-sm border-b border-[#dcdcdc] flex-none">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
            {/* Logo */}
            <button 
              onClick={() => handleModeChange('daily')}
              className="flex items-center gap-2 text-[#4a4a4a] hover:opacity-80 transition-opacity self-start md:self-center"
            >
                <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
                <span className="font-serif font-bold text-lg tracking-tight">하루 한장, 역설의 가르침 365</span>
            </button>
            
            {/* Main Mode Switcher */}
            <div className="flex bg-[#faf9f6] rounded-full p-1 border border-[#dcdcdc] shadow-sm">
                <button 
                  onClick={() => handleModeChange('daily')}
                  className={`px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-all ${readingMode === 'daily' ? 'bg-[#5a5a5a] text-white shadow-md' : 'text-[#8a8a8a] hover:text-[#5a5a5a]'}`}
                >
                  오늘
                </button>
                <button 
                  onClick={() => handleModeChange('book')}
                  className={`px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-all flex items-center gap-1 ${readingMode === 'book' ? 'bg-[#5a5a5a] text-white shadow-md' : 'text-[#8a8a8a] hover:text-[#5a5a5a]'}`}
                >
                  <Book className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  책 읽기
                </button>
                <button 
                  onClick={() => handleModeChange('random')}
                  className={`px-3 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-all flex items-center gap-1 ${readingMode === 'random' ? 'bg-[#5a5a5a] text-white shadow-md' : 'text-[#8a8a8a] hover:text-[#5a5a5a]'}`}
                >
                  <Shuffle className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  랜덤
                </button>
            </div>

            {/* Utility Menus */}
            <div className="flex gap-2 self-end md:self-center">
              <button 
                  onClick={() => setViewMode(viewMode === 'list' ? 'main' : 'list')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors text-sm font-medium ${viewMode === 'list' ? 'bg-[#5a5a5a] text-white' : 'bg-[#faf9f6] text-[#5a5a5a] border border-[#dcdcdc]'}`}
                  title="전체 목록"
              >
                  {viewMode === 'list' ? <X className="w-4 h-4" /> : <List className="w-4 h-4" />}
                  <span className="hidden md:inline">{viewMode === 'list' ? '닫기' : '목록'}</span>
              </button>

              <button 
                  onClick={() => setViewMode(viewMode === 'notes' ? 'main' : 'notes')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors text-sm font-medium ${viewMode === 'notes' ? 'bg-[#5a5a5a] text-white' : 'bg-[#faf9f6] text-[#5a5a5a] border border-[#dcdcdc]'}`}
                  title="나의 단상 (노트)"
              >
                  {viewMode === 'notes' ? <X className="w-4 h-4" /> : <NotebookPen className="w-4 h-4" />}
                  <span className="hidden md:inline">{viewMode === 'notes' ? '닫기' : '나의 노트'}</span>
              </button>

              <button 
                  onClick={() => setViewMode(viewMode === 'favorites' ? 'main' : 'favorites')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-sm transition-colors text-sm font-medium ${viewMode === 'favorites' ? 'bg-[#c45d3d] text-white' : 'bg-[#faf9f6] text-[#5a5a5a] border border-[#dcdcdc]'}`}
                  title="보관함"
              >
                  {viewMode === 'favorites' ? <Star className="w-4 h-4 fill-white" /> : <Star className="w-4 h-4" />}
                  <span className="hidden md:inline">보관함</span>
              </button>
            </div>
        </div>
      </header>

      {/* Main Content: Flexible height, centered */}
      {/* Reduced padding for all devices to keep card large and centered without badges */}
      <main className="flex-grow flex flex-col items-center justify-center p-2 w-full h-[calc(100vh-80px)] overflow-hidden relative">
        
        {/* VIEW: FAVORITES */}
        {viewMode === 'favorites' && (
            <div className="w-full max-w-4xl animate-fade-in bg-[#faf9f6] p-4 md:p-8 rounded shadow-lg border border-[#e5e5e5] h-full overflow-y-auto custom-scrollbar">
                <h2 className="text-xl md:text-2xl font-serif font-bold mb-6 text-[#4a4a4a] border-b border-[#e5e5e5] pb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 md:w-6 md:h-6 text-[#c45d3d]" />
                  나의 보석상자
                </h2>
                {favorites.length === 0 ? (
                    <div className="text-center py-20">
                        <Star className="w-10 h-10 md:w-12 md:h-12 text-[#e5e5e5] mx-auto mb-4" />
                        <p className="text-[#9a9a9a] font-serif">마음에 드는 명언을 저장해보세요.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:gap-6">
                        {favorites.map((fav, i) => (
                            <button 
                                key={i} 
                                onClick={() => {
                                    // Parse YYYY-MM-DD to get M/D key
                                    const [y, m, d] = fav.date.split('-').map(Number);
                                    handleDateSelect(`${m}/${d}`);
                                }}
                                className="w-full text-left p-4 md:p-6 border-b border-gray-100 hover:bg-[#f3f3f3] transition-colors relative group"
                            >
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <div 
                                      onClick={(e) => {
                                          e.stopPropagation(); // Prevent card navigation when clicking delete
                                          const newFavs = favorites.filter(f => f.data.quote !== fav.data.quote);
                                          setFavorites(newFavs);
                                          localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavs));
                                          showToast("삭제되었습니다");
                                      }} 
                                      className="text-[#9a9a9a] hover:text-red-400 p-2 cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                  </div>
                                </div>
                                <p className="font-serif text-base md:text-lg text-ink leading-relaxed mb-2 text-[#1a1a1a]">"{fav.data.quote}"</p>
                                <span className="text-xs text-[#9a9a9a] block text-right mt-2">{fav.date} 저장됨</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* VIEW: NOTES */}
        {viewMode === 'notes' && (
            <div className="w-full max-w-4xl animate-fade-in bg-[#faf9f6] p-4 md:p-8 rounded shadow-lg border border-[#e5e5e5] h-full overflow-y-auto custom-scrollbar">
                <h2 className="text-xl md:text-2xl font-serif font-bold mb-6 text-[#4a4a4a] border-b border-[#e5e5e5] pb-4 flex items-center gap-2">
                  <NotebookPen className="w-5 h-5 md:w-6 md:h-6 text-[#4a4a4a]" />
                  나의 단상 기록
                </h2>
                {sortedNotesList.length === 0 ? (
                    <div className="text-center py-20">
                        <NotebookPen className="w-10 h-10 md:w-12 md:h-12 text-[#e5e5e5] mx-auto mb-4" />
                        <p className="text-[#9a9a9a] font-serif">명언을 읽고 떠오르는 생각을 기록해보세요.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:gap-6">
                        {sortedNotesList.map(([dateStr, fullTextVal], i) => {
                            const fullText = fullTextVal as string;
                            // Safe parsing of "YYYY-MM-DD"
                            const [y, m, d] = dateStr.split('-').map(Number);
                            const quoteKey = `${m}/${d}`;
                            const quote = FIXED_QUOTES[quoteKey] || "저장된 명언 데이터가 없습니다.";
                            
                            // Extract signature
                            const match = fullText.match(DATE_SIGNATURE_REGEX);
                            const content = match ? fullText.replace(DATE_SIGNATURE_REGEX, '') : fullText;
                            const signature = match ? match[0].trim() : '';

                            return (
                                <button 
                                  key={i} 
                                  onClick={() => handleDateSelect(quoteKey)}
                                  className="text-left w-full p-4 md:p-6 border border-gray-100 rounded bg-[#fffdf9] hover:bg-[#f3f3f3] transition-colors shadow-sm group"
                                >
                                    <div className="flex justify-between items-baseline mb-2 md:mb-3">
                                        <span className="font-sans text-xs font-bold text-[#9a9a9a] uppercase tracking-wider">{y}.{m}.{d}</span>
                                    </div>
                                    <p className="font-serif text-xs md:text-sm text-[#9a9a9a] italic mb-2 md:mb-3 line-clamp-1">"{quote}"</p>
                                    <p className="font-serif text-base md:text-lg text-[#1a1a1a] text-ink leading-relaxed whitespace-pre-wrap">{content}</p>
                                    {signature && (
                                        <p className="text-xs text-[#9a9a9a] font-serif text-right mt-2">{signature}</p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        {/* VIEW: LIST (CALENDAR) */}
        {viewMode === 'list' && (
          <div className="w-full max-w-4xl animate-fade-in bg-[#faf9f6] p-4 md:p-6 rounded shadow-lg border border-[#e5e5e5] h-full overflow-y-auto custom-scrollbar">
            <h2 className="text-xl md:text-2xl font-serif font-bold mb-4 md:mb-6 text-[#4a4a4a] border-b border-[#e5e5e5] pb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 md:w-6 md:h-6" />
              전체 명언 목록 ({sortedQuotesList.length}개)
            </h2>
            <div className="pb-4">
              {sortedQuotesList.map(([dateKey, text]) => {
                  // Check if this date has a note
                  // Convert 1/1 to current year YYYY-01-01 key
                  const targetDate = getDateFromKey(dateKey);
                  const noteKey = getLocalDateString(targetDate);
                  const hasNote = !!notes[noteKey];

                  return (
                    <button 
                      key={dateKey}
                      onClick={() => handleDateSelect(dateKey)}
                      className={`w-full text-left p-3 md:p-4 border-b border-gray-100 hover:bg-[#f3f3f3] transition-colors flex gap-4 md:gap-6 group items-center ${selectedDateKey === dateKey ? 'bg-[#f3f3f3]' : ''}`}
                    >
                      <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 border border-[#e5e5e5] rounded-sm flex flex-col items-center justify-center text-[#5a5a5a] bg-white">
                        <span className="text-[9px] md:text-[10px] tracking-widest uppercase border-b border-gray-100 w-full text-center pb-1">{dateKey.split('/')[0]}월</span>
                        <span className="text-lg md:text-xl font-serif font-bold pt-1">{dateKey.split('/')[1]}</span>
                      </div>
                      <div className="flex-grow py-1">
                        <p className="font-serif text-[#1a1a1a] text-base md:text-lg group-hover:text-[#c45d3d] line-clamp-1 transition-colors text-ink">
                          {text}
                        </p>
                      </div>
                      {/* Indicator if this date has a note */}
                      {hasNote && (
                          <PenLine className="w-3 h-3 md:w-4 md:h-4 text-[#c45d3d]" />
                      )}
                    </button>
                  );
              })}
            </div>
          </div>
        )}

        {/* VIEW: MAIN QUOTE CARD (Daily / Random / Book) */}
        {viewMode === 'main' && (
            <div className="w-full h-full flex flex-col items-center justify-center pb-24 md:pb-0">
                {/* Status Badge has been removed for ALL devices as per user request */}
                
                {loading ? (
                    <div className="flex flex-col items-center justify-center flex-grow">
                        <Loader2 className="w-8 h-8 text-[#dcdcdc] animate-spin mb-4" />
                        <p className="text-[#9a9a9a] font-serif tracking-widest text-sm">
                          Loading...
                        </p>
                    </div>
                ) : currentQuote ? (
                    <QuoteCard 
                        quoteData={currentQuote} 
                        date={displayDate}
                        isSaved={isCurrentSaved} 
                        onToggleSave={toggleFavorite}
                        hasNote={!!notes[currentNoteDateKey]}
                        onOpenNote={handleOpenNote}
                        mode={readingMode}
                        onPrev={() => handleBookNavigate('prev')}
                        onNext={() => handleBookNavigate('next')}
                        onRandom={loadRandomQuote}
                    />
                ) : (
                    <div className="text-center py-20 text-[#c45d3d] font-serif">
                        페이지를 불러올 수 없습니다.
                    </div>
                )}
            </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#2d3436] text-white px-6 py-2 rounded-full shadow-lg text-sm font-sans animate-fade-in z-[60]">
             {toastMessage}
          </div>
        )}

        {/* Install Prompt Hint - Updated with Book Cover Fallback */}
        {showInstallHint && !loading && (
            <div className="absolute bottom-5 left-4 right-4 md:bottom-8 md:left-auto md:right-8 md:w-80 z-20 animate-fade-in">
                <div className="bg-[#1a1a1a]/95 backdrop-blur-sm border border-gray-700 rounded-lg p-4 shadow-2xl relative text-left flex gap-4 items-center">
                    <button 
                        onClick={() => setShowInstallHint(false)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white transition-colors"
                        title="닫기"
                    >
                        <X className="w-3 h-3" />
                    </button>
                    
                    {/* Book Cover Image with Fallback */}
                    <div className="flex-shrink-0 w-12 h-16 bg-[#2d3436] rounded overflow-hidden border border-gray-600 shadow-md flex items-center justify-center">
                        {!bookCoverError ? (
                            <img 
                                src="book_cover.png" 
                                alt="책 표지" 
                                className="w-full h-full object-cover" 
                                onError={() => setBookCoverError(true)} 
                            />
                        ) : (
                            <Book className="w-6 h-6 text-gray-500" />
                        )}
                    </div>

                    <div>
                        <p className="text-[#ffd700] font-bold text-xs mb-1.5 flex items-center gap-1.5">
                            <span>📱</span> 앱으로 소장하기
                        </p>
                        <p className="text-gray-200 text-[11px] leading-relaxed font-sans">
                            매일 한 장의 가르침을 받아보세요.<br/>
                            <span className="font-bold underline decoration-white/30">“홈 화면에 추가”</span>를 눌러주세요.
                        </p>
                    </div>
                </div>
            </div>
        )}

      </main>

      {/* NOTE MODAL */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#faf9f6] w-full max-w-lg rounded shadow-2xl overflow-hidden animate-slide-up relative">
            {/* Paper texture overlay */}
            <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-multiply" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
            </div>

            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-[#e5e5e5] relative z-10 bg-[#faf9f6]/80">
                <div className="flex items-center gap-2 text-[#4a4a4a]">
                    <PenLine className="w-5 h-5" />
                    <span className="font-serif font-bold">나의 단상 (My Note)</span>
                </div>
                <button 
                  onClick={() => setIsNoteModalOpen(false)}
                  className="text-[#9a9a9a] hover:text-[#4a4a4a] transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6 relative z-10">
                <div className="mb-4">
                    <p className="text-sm text-[#9a9a9a] font-serif mb-2 text-center">{displayDate.toLocaleDateString()}</p>
                    <p className="font-serif text-[#1a1a1a] text-center text-base md:text-lg px-2 border-b border-dotted border-gray-300 pb-4 text-ink">"{currentQuote?.quote}"</p>
                </div>
                
                <textarea 
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="이 명언을 보고 떠오르는 생각이나 감정을 자유롭게 적어보세요..."
                    className="w-full h-40 bg-transparent border-none focus:ring-0 text-[#1a1a1a] text-ink font-serif text-base md:text-lg leading-relaxed placeholder:text-gray-300 resize-none p-0 custom-scrollbar"
                    style={{ 
                        backgroundImage: 'linear-gradient(transparent 1.9rem, #e5e5e5 1.9rem)', 
                        backgroundSize: '100% 2rem',
                        lineHeight: '2rem'
                    }}
                />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#e5e5e5] bg-[#f3f3f3] relative z-10 flex justify-end gap-3">
                <button 
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 text-[#9a9a9a] hover:text-[#5a5a5a] font-medium text-sm transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleSaveNote}
                  className="px-5 py-2 bg-[#5a5a5a] text-white rounded-sm hover:bg-[#2d3436] transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  저장하기
                </button>
            </div>
          </div>
        </div>
      )}
      
      <footer className="p-2 md:p-4 text-center text-[#9a9a9a] text-[10px] md:text-xs font-serif flex-none">
        &copy; {today.getFullYear()} 하루 한장, 역설의 가르침 365
      </footer>
    </div>
  );
};

export default App;