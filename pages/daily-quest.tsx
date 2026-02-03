
import React, { useState, useEffect } from 'react';
import { UserSession } from '../types';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { QuestService, QuestStory } from '../services/quest.service';
import { audio } from '../services/audio.service';

const DailyQuestPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [gameState, setGameState] = useState<'LOADING' | 'STORY' | 'QUIZ' | 'VICTORY'>('LOADING');
  const [story, setStory] = useState<QuestStory | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuest();
  }, [user.studentId]);

  const loadQuest = async () => {
    if (!user.studentId) return;
    try {
      const data = await QuestService.generateStory(user.studentId);
      setStory(data);
      setGameState('STORY');
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('VITE_GOOGLE_API_KEY')) {
         setError("System Error: AI Key Missing. Please check settings.");
      } else {
         setError("Failed to load your quest. Please try again later.");
      }
    }
  };

  const handleAnswer = (option: string) => {
    if (!story) return;
    audio.playClick();
    setSelectedOption(option);
    
    const isCorrect = option === story.quiz[currentQuestion].a;
    
    setTimeout(async () => {
      if (isCorrect) {
        setScore(prev => prev + 1);
        audio.playYehey();
      }
      
      if (currentQuestion + 1 < story.quiz.length) {
        setCurrentQuestion(prev => prev + 1);
        setSelectedOption(null);
      } else {
        // Game Over - Victory
        setGameState('VICTORY');
        audio.playYehey();
        if (user.studentId) {
            await QuestService.completeQuest(user.studentId);
        }
      }
    }, 1000);
  };

  if (error) {
    return (
      <div className="p-10 text-center space-y-4 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-4xl">⚠️</div>
        <p className="text-red-500 font-bold uppercase tracking-widest">{error}</p>
        <button onClick={() => window.location.reload()} className="text-pink-500 font-black underline">Reload</button>
        <Link to="/portal" className="text-gray-400 text-xs font-bold uppercase mt-4">Back to Portal</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf2f8] p-4 md:p-6 flex flex-col items-center animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link to="/portal" onClick={() => audio.playClick()} className="text-gray-400 hover:text-pink-500 flex items-center gap-2 transition-colors font-bold text-xs uppercase tracking-widest">
          <ArrowLeft size={16} /> Back to Portal
        </Link>
        <div className="bg-white px-4 py-2 rounded-full shadow-sm text-pink-500 font-black text-xs uppercase tracking-widest border border-pink-50">
          🌱 Daily Quest
        </div>
      </div>

      {/* GAME CONTAINER */}
      <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-xl shadow-pink-100/50 border border-pink-50 overflow-hidden min-h-[500px] relative">
        
        {/* STATE: LOADING */}
        {gameState === 'LOADING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <div className="animate-bounce text-6xl mb-6">✨</div>
            <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Asking the AI for a new story...</p>
          </div>
        )}

        {/* STATE: STORY READING */}
        {gameState === 'STORY' && story && (
          <div className="p-8 md:p-12 animate-in slide-in-from-right duration-500">
            <h1 className="text-2xl md:text-3xl font-black text-gray-800 mb-6 uppercase tracking-tight leading-tight">{story.title}</h1>
            <div className="prose prose-pink prose-p:font-medium prose-p:text-gray-600 prose-p:text-sm md:prose-p:text-base prose-p:leading-loose mb-8">
              {story.content}
            </div>
            <button 
              onClick={() => { audio.playClick(); setGameState('QUIZ'); }}
              className="w-full bg-pink-500 text-white py-4 rounded-2xl font-black text-sm hover:bg-pink-600 transition-all shadow-lg shadow-pink-200 hover:shadow-xl uppercase tracking-widest hover:-translate-y-1 active:translate-y-0"
            >
              I'm Ready for the Quiz! 🚀
            </button>
          </div>
        )}

        {/* STATE: QUIZ */}
        {gameState === 'QUIZ' && story && (
          <div className="p-8 md:p-12 animate-in slide-in-from-right duration-500">
            <div className="flex justify-between text-gray-400 text-[10px] font-black uppercase tracking-widest mb-8">
              <span>Question {currentQuestion + 1} of {story.quiz.length}</span>
              <span>Score: {score}</span>
            </div>
            
            <h2 className="text-xl md:text-2xl font-black text-gray-800 mb-8 leading-tight">
              {story.quiz[currentQuestion].q}
            </h2>

            <div className="space-y-4">
              {story.quiz[currentQuestion].options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  disabled={selectedOption !== null}
                  className={`w-full p-5 rounded-2xl border-2 text-left font-bold text-sm transition-all relative
                    ${selectedOption === opt 
                      ? (opt === story.quiz[currentQuestion].a ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700')
                      : 'border-gray-50 hover:border-pink-200 hover:bg-pink-50 text-gray-600'}
                  `}
                >
                  {opt}
                  {selectedOption === opt && opt === story.quiz[currentQuestion].a && <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" size={20} />}
                  {selectedOption === opt && opt !== story.quiz[currentQuestion].a && <XCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500" size={20} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STATE: VICTORY */}
        {gameState === 'VICTORY' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-white to-green-50 animate-in zoom-in duration-500">
            <div className="text-8xl mb-6 animate-bounce">🌳</div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-800 mb-2 uppercase tracking-tighter">You Flourished!</h2>
            <p className="text-gray-400 mb-8 font-medium text-xs uppercase tracking-widest">You watered your plant and grew closer to God today.</p>
            
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-50 w-full max-w-sm mb-8">
              <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest mb-1">Total Rewards</p>
              <p className="text-4xl font-black text-green-500 tracking-tight">+5 Stars</p>
            </div>

            <Link to="/portal">
              <button onClick={() => audio.playClick()} className="bg-pink-500 text-white py-4 px-10 rounded-2xl font-black shadow-xl shadow-pink-200 hover:bg-pink-600 uppercase tracking-widest text-xs transition-all hover:-translate-y-1">
                Collect Rewards & Exit
              </button>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
};

export default DailyQuestPage;
