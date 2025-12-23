import React, { useState, useEffect } from 'react';
import { Quote, StoredQuote } from './types';
import { generateQuoteOfDay, getRandomQuoteKey } from './services/geminiService';
import { FIXED_QUOTES } from './services/quotesData';
import { QuoteCard } from './components/QuoteCard';
import { Loader2, BookOpen, Star, X, List, Calendar, PenLine, Save, Shuffle, Book, NotebookPen, ChevronRight } from 'lucide-react';

// Keys for persistence
const FAVORITES_KEY = 'favorite_quotes_v2';
const NOTES_KEY = 'user_notes_v1';
const BOOKMARK_KEY = 'last_read_page_v1';
const DATE_SIGNATURE_REGEX = /\n\n — \d{4}\. \d{1,2}\. \d{1,2}\.$/;

type ViewMode = 'main' | 'favorites' | 'list' | 'notes';
type ReadingMode = 'daily' | 'random' | 'book';

const App: React.FC = () => {
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [favorites, setFavorites] = useState<StoredQuote[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  
  const [viewMode, setViewMode] = useState<ViewMode>('main'); 
  const [readingMode, setReadingMode] = useState<ReadingMode>('daily');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const today = new Date();
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = getLocalDateString(today);

  useEffect(() => {
    const storedFavs = localStorage.getItem(FAVORITES_KEY);
    if (storedFavs) setFavorites(JSON.parse(storedFavs));
    const storedNotes = localStorage.getItem(NOTES_KEY);
    if (storedNotes) setNotes(JSON.parse(storedNotes));
    
    loadQuoteByDate(today, false, true);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const loadQuoteByDate = async (targetDate: Date, forceRefresh = false, silent = false) => {
    if (!silent) setLoading(true);
    
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    const dateKey = `${month}/${day}`;
    const cacheKey = `quote_cache_v5_${month}_${day}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (FIXED_QUOTES[dateKey]) {
         const fixedQuote: Quote = { quote: FIXED_QUOTES[dateKey], author: "", meaning: "", tags: [] };
         setCurrentQuote(fixedQuote);
         setSelectedDateKey(dateKey);
         if (!silent) setLoading(false);
         return;
    }

    if (!forceRefresh && cachedData) {
      setCurrentQuote(JSON.parse(cachedData));
      setSelectedDateKey(dateKey);
      if (!silent) setLoading(false);
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
      if (!silent) setLoading(false);
    }
  };

  const handleModeChange = (mode: ReadingMode) => {
    setReadingMode(mode);
    setViewMode('main');
    if (mode === 'daily') {
        loadQuoteByDate(new Date());
    } else if (mode === 'random') {
        loadRandomQuote();
    } else if (mode === 'book') {
        const savedKey = localStorage.getItem(BOOKMARK_KEY) || "1/1";
        loadQuoteByDate(getDateFromKey(savedKey));
    }
  };

  const loadRandomQuote = () => {
    const randomKey = getRandomQuoteKey();
    loadQuoteByDate(getDateFromKey(randomKey));
  };

  const handleBookNavigate = (direction: 'next' | 'prev') => {
    if (!selectedDateKey) return;
    const currentDate = getDateFromKey(selectedDateKey);
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    const nextKey = `${nextDate.getMonth() + 1}/${nextDate.getDate()}`;
    localStorage.setItem(BOOKMARK_KEY, nextKey);
    loadQuoteByDate(nextDate);
  };

  const getDateFromKey = (key: string): Date => {
    const [month, day] = key.split('/').map(Number);
    const date = new Date();
    date.setMonth(month - 1);
    date.setDate(day);
    return date;
  };

  const handleDateSelect = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    loadQuoteByDate(getDateFromKey(dateKey));
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

  const handleOpenNote = () => {
    const displayDate = selectedDateKey ? getDateFromKey(selectedDateKey) : today;
    const currentNoteDateKey = getLocalDateString(displayDate);
    let text = notes[currentNoteDateKey] || '';
    // 편집 시에는 서명을 제거하여 중복 생성을 방지합니다.
    setNoteText(text.replace(DATE_SIGNATURE_REGEX, ''));
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = () => {
    const displayDate = selectedDateKey ? getDateFromKey(selectedDateKey) : today;
    const currentNoteDateKey = getLocalDateString(displayDate);
    if (!noteText.trim()) {
        const newNotes = { ...notes };
        delete newNotes[currentNoteDateKey];
        setNotes(newNotes);
        localStorage.setItem(NOTES_KEY, JSON.stringify(newNotes));
        showToast("메모가 삭제되었습니다.");
        setIsNoteModalOpen(false);
        return;
    }
    // 저장 시 자동으로 날짜 서명을 추가합니다.
    const signature = `\n\n — ${new Date().getFullYear()}. ${new Date().getMonth() + 1}. ${new Date().getDate()}.`;
    const newNotes = { ...notes, [currentNoteDateKey]: noteText.trim() + signature };
    setNotes(newNotes);
    localStorage.setItem(NOTES_KEY, JSON.stringify(newNotes));
    showToast("메모가 저장되었습니다.");
    setIsNoteModalOpen(false);
  };

  return (
    <div className="min-h-screen font-sans text-gray-900 relative flex flex-col bg-[#e3e1db] overflow-x-hidden">
      
      {/* HEADER */}
      <header className="px-4 py-3 sticky top-0 z-50 bg-[#e3e1db]/90 backdrop-blur-md border-b border-[#dcdcdc]">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-4">
            <button onClick={() => setViewMode('main')} className="flex items-center gap-3 text-navy hover:opacity-70 transition-opacity">
                <BookOpen className="w-6 h-6 text-gold" />
                <span className="font-serif font-bold text-xl tracking-tight hidden sm:inline">역설의 가르침 365</span>
            </button>
            
            <div className="flex bg-white/50 rounded-full p-1 border border-[#dcdcdc] shadow-inner">
                <button onClick={() => handleModeChange('daily')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${readingMode === 'daily' ? 'bg-navy text-white shadow-md' : 'text-gray-400'}`}>오늘</button>
                <button onClick={() => handleModeChange('book')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${readingMode === 'book' ? 'bg-navy text-white shadow-md' : 'text-gray-400'}`}><Book className="w-3.5 h-3.5" /> 책읽기</button>
                <button onClick={() => handleModeChange('random')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${readingMode === 'random' ? 'bg-navy text-white shadow-md' : 'text-gray-400'}`}><Shuffle className="w-3.5 h-3.5" /> 랜덤</button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setViewMode(viewMode === 'list' ? 'main' : 'list')} className={`p-2.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-navy text-white' : 'bg-white text-navy border border-[#dcdcdc] hover:bg-gray-50'}`} title="목록 보기"><List className="w-4 h-4" /></button>
              <button onClick={() => setViewMode(viewMode === 'notes' ? 'main' : 'notes')} className={`p-2.5 rounded-full transition-all ${viewMode === 'notes' ? 'bg-navy text-white' : 'bg-white text-navy border border-[#dcdcdc] hover:bg-gray-50'}`} title="기록 보기"><NotebookPen className="w-4 h-4" /></button>
              <button onClick={() => setViewMode(viewMode === 'favorites' ? 'main' : 'favorites')} className={`p-2.5 rounded-full transition-all ${viewMode === 'favorites' ? 'bg-[#c45d3d] text-white' : 'bg-white text-navy border border-[#dcdcdc] hover:bg-gray-50'}`} title="보관함"><Star className={`w-4 h-4 ${viewMode === 'favorites' ? 'fill-white' : ''}`} /></button>
            </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-grow flex flex-col items-center justify-center p-4 w-full h-[calc(100vh-80px)]">
        
        {viewMode === 'favorites' && (
            <div className="w-full max-w-2xl animate-fade-in bg-white p-6 md:p-10 rounded-xl shadow-2xl h-full overflow-y-auto custom-scrollbar border border-gold/20">
                <h2 className="text-2xl font-serif font-bold mb-8 text-navy flex items-center gap-3 border-b border-gold/10 pb-4">
                  <Star className="w-6 h-6 text-[#c45d3d] fill-[#c45d3d]" /> 나의 보석상자
                </h2>
                {favorites.length === 0 ? (
                    <div className="text-center py-24 flex flex-col items-center"><Star className="w-16 h-16 text-gray-100 mb-4" /><p className="text-gray-400 font-serif text-lg">마음에 드는 명언을 보관해보세요.</p></div>
                ) : (
                    <div className="space-y-2">
                        {favorites.map((fav, i) => (
                            <button key={i} onClick={() => handleDateSelect(`${fav.date.split('-')[1]}/${fav.date.split('-')[2]}`)} className="w-full text-left p-6 border-b border-gray-50 hover:bg-gold/5 transition-all group rounded-lg">
                                <p className="font-serif text-lg text-navy leading-relaxed mb-2 transition-transform group-hover:translate-x-1">"{fav.data.quote}"</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-300 tracking-widest uppercase font-sans">COLLECTED AT {fav.date}</span>
                                    <ChevronRight className="w-4 h-4 text-gold opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )}

        {viewMode === 'notes' && (
            <div className="w-full max-w-2xl animate-fade-in bg-white p-6 md:p-10 rounded-xl shadow-2xl h-full overflow-y-auto custom-scrollbar border border-gold/20">
                <h2 className="text-2xl font-serif font-bold mb-8 text-navy flex items-center gap-3 border-b border-gold/10 pb-4">
                  <NotebookPen className="w-6 h-6 text-navy" /> 나의 단상 기록
                </h2>
                {Object.keys(notes).length === 0 ? (
                    <div className="text-center py-24 flex flex-col items-center"><NotebookPen className="w-16 h-16 text-gray-100 mb-4" /><p className="text-gray-400 font-serif text-lg">생각을 기록해보세요.</p></div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(notes).sort((a,b) => b[0].localeCompare(a[0])).map(([dateStr, fullText], i) => {
                            const textStr = fullText as string;
                            const content = textStr.replace(DATE_SIGNATURE_REGEX, '');
                            const signatureMatch = textStr.match(DATE_SIGNATURE_REGEX);
                            const signature = signatureMatch ? signatureMatch[0].replace(/\n\n — /, '').replace(/\. /g, '-') : '';

                            return (
                                <div key={i} className="text-left w-full p-8 border border-gray-100 rounded-xl bg-paper hover:shadow-lg transition-all group relative">
                                    <div className="flex justify-between items-center mb-4">
                                        {/* 명언의 날짜 스타일: 기존 금색 스타일로 복구 */}
                                        <span className="text-xs font-bold text-gold tracking-widest uppercase">{dateStr.replace(/-/g, '. ')}</span>
                                        <button onClick={() => handleDateSelect(`${dateStr.split('-')[1]}/${dateStr.split('-')[2]}`)} className="text-gray-300 hover:text-navy transition-colors"><ChevronRight className="w-5 h-5" /></button>
                                    </div>
                                    <p className="font-serif text-navy text-lg leading-relaxed whitespace-pre-wrap">{content}</p>
                                    {signature && (
                                        <div className="mt-6 flex justify-end">
                                            {/* 하단 기록 일시 정보: 보관함과 동일한 스타일 적용 */}
                                            <span className="text-[10px] text-gray-300 tracking-widest uppercase font-sans">RECORDED AT {signature.endsWith('.') ? signature.slice(0, -1) : signature}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        {viewMode === 'list' && (
          <div className="w-full max-w-4xl animate-fade-in bg-white p-6 md:p-10 rounded-xl shadow-2xl h-full overflow-y-auto custom-scrollbar border border-gold/20">
            <h2 className="text-2xl font-serif font-bold mb-8 text-navy flex items-center gap-3 border-b border-gold/10 pb-4">
              <Calendar className="w-6 h-6 text-navy" /> 전체 가르침 목록
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {Object.entries(FIXED_QUOTES).map(([dateKey, text]) => (
                <button key={dateKey} onClick={() => handleDateSelect(dateKey)} className="text-left p-4 border-b border-gray-50 hover:bg-gold/5 transition-all flex gap-6 items-center group rounded-lg">
                  <span className="font-serif font-bold text-gold text-lg min-w-[50px]">{dateKey}</span>
                  <p className="font-serif text-navy text-sm truncate opacity-60 group-hover:opacity-100 transition-opacity">{text}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'main' && (
            <div className="w-full h-full flex flex-col items-center justify-center">
                {loading ? (
                    <div className="flex flex-col items-center"><Loader2 className="w-10 h-10 text-gold animate-spin mb-4" /><p className="text-gray-400 font-serif text-sm tracking-[0.2em] uppercase">Loading Wisdom...</p></div>
                ) : currentQuote ? (
                    <QuoteCard 
                        quoteData={currentQuote} 
                        date={selectedDateKey ? getDateFromKey(selectedDateKey) : today}
                        isSaved={favorites.some(f => f.data.quote === currentQuote.quote)} 
                        onToggleSave={toggleFavorite}
                        hasNote={!!notes[getLocalDateString(selectedDateKey ? getDateFromKey(selectedDateKey) : today)]}
                        onOpenNote={handleOpenNote}
                        mode={readingMode}
                        onPrev={() => handleBookNavigate('prev')}
                        onNext={() => handleBookNavigate('next')}
                        onRandom={loadRandomQuote}
                    />
                ) : null}
            </div>
        )}

        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-navy text-gold px-8 py-3 rounded-full shadow-2xl text-sm font-serif animate-slide-up z-[200] border border-gold/30 backdrop-blur-xl">
             {toastMessage}
          </div>
        )}
      </main>

      {/* Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-navy/90 backdrop-blur-lg animate-fade-in">
          <div className="bg-paper w-full max-w-xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up relative border border-gold/30">
            <div className="flex justify-between items-center p-6 border-b border-gold/10 bg-white/40">
                <span className="font-serif font-bold text-navy text-xl flex items-center gap-3"><PenLine className="w-5 h-5" /> 오늘의 단상</span>
                <button onClick={() => setIsNoteModalOpen(false)} className="text-gray-400 hover:text-navy transition-colors"><X className="w-7 h-7" /></button>
            </div>
            <div className="p-8">
                <p className="font-serif text-navy/40 text-center text-lg italic mb-10 leading-relaxed px-4">"{currentQuote?.quote}"</p>
                <textarea 
                    value={noteText}
                    autoFocus
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="이 명언이 당신의 영혼에 어떤 울림을 주었나요? 자유롭게 적어보세요..."
                    className="w-full h-64 bg-transparent border-none focus:ring-0 text-navy font-serif text-xl leading-relaxed placeholder:text-gray-200 resize-none p-0 custom-scrollbar"
                />
            </div>
            <div className="p-6 border-t border-gold/10 bg-gray-50/50 flex justify-end gap-4">
                <button onClick={() => setIsNoteModalOpen(false)} className="px-6 py-2.5 text-gray-400 font-serif text-sm hover:text-navy transition-colors">닫기</button>
                <button onClick={handleSaveNote} className="px-8 py-2.5 bg-navy text-gold rounded-full hover:bg-black font-serif text-sm shadow-xl flex items-center gap-3 transition-all transform active:scale-95"><Save className="w-4 h-4" /> 기록 저장</button>
            </div>
          </div>
        </div>
      )}
      
      <footer className="p-6 text-center text-[10px] font-serif tracking-[0.2em] opacity-40 text-navy">
        &copy; {today.getFullYear()} THE TEACHING OF PARADOX 365. PRODUCED BY CELESTIAL WISDOM.
      </footer>
    </div>
  );
};

export default App;