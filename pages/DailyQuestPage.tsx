
import React, { useState, useEffect, useCallback } from 'react';
import { UserSession } from '../types';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Volume2, VolumeX, Sparkles, Star } from 'lucide-react';
import { QuestService, QuestStory } from '../services/quest.service';
import { audio } from '../services/audio.service';

// Animated mascot character component
const Mascot: React.FC<{ emotion: 'happy' | 'thinking' | 'excited' | 'celebrating' }> = ({ emotion }) => {
  const getEmoji = () => {
    switch (emotion) {
      case 'happy': return '🌱';
      case 'thinking': return '🤔';
      case 'excited': return '🤩';
      case 'celebrating': return '🎉';
      default: return '🌱';
    }
  };

  return (
    <div className="relative">
      <div className={`text-6xl md:text-8xl transition-all duration-500 ${
        emotion === 'celebrating' ? 'animate-bounce' : 'animate-pulse'
      }`}>
        {getEmoji()}
      </div>
      {emotion === 'thinking' && (
        <div className="absolute -top-4 -right-4 text-2xl animate-bounce">
          💭
        </div>
      )}
      {emotion === 'excited' && (
        <>
          <div className="absolute -top-2 -left-4 text-xl animate-ping">✨</div>
          <div className="absolute -top-2 -right-4 text-xl animate-ping delay-100">✨</div>
        </>
      )}
    </div>
  );
};

// Confetti particle component
const Confetti: React.FC = () => {
  const colors = ['#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6'];
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(30)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${1 + Math.random() * 2}s`
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: colors[Math.floor(Math.random() * colors.length)],
              transform: `rotate(${Math.random() * 360}deg)`
            }}
          />
        </div>
      ))}
    </div>
  );
};

// Progress bar with animation
const ProgressBar: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  const progress = ((current + 1) / total) * 100;
  
  return (
    <div className="w-full bg-gray-100 rounded-full h-4 mb-6 overflow-hidden border-2 border-pink-100">
      <div 
        className="h-full bg-gradient-to-r from-pink-400 via-purple-400 to-pink-500 rounded-full transition-all duration-700 ease-out relative"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute inset-0 bg-white/30 animate-pulse" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
          <Star className="text-yellow-400 w-5 h-5 fill-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
      </div>
    </div>
  );
};

// Floating stars background
const FloatingStars: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute text-yellow-200 opacity-50"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`
          }}
        >
          <Star size={20 + i * 5} className="fill-current" />
        </div>
      ))}
    </div>
  );
};

const DailyQuestPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [gameState, setGameState] = useState<'LOADING' | 'STORY' | 'QUIZ' | 'VICTORY'>('LOADING');
  const [story, setStory] = useState<QuestStory | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [typedContent, setTypedContent] = useState('');
  const [mascotEmotion, setMascotEmotion] = useState<'happy' | 'thinking' | 'excited' | 'celebrating'>('thinking');
  const [showConfetti, setShowConfetti] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Sound effect helpers
  const playSound = useCallback((soundName: 'click' | 'yehey' | 'success' | 'error') => {
    if (!audioEnabled) return;
    
    switch (soundName) {
      case 'click':
        audio.playClick();
        break;
      case 'yehey':
        audio.playYehey();
        break;
      case 'success':
        // Play success sound with higher pitch
        audio.playYehey();
        break;
      case 'error':
        // Could add error sound here
        audio.playClick();
        break;
    }
  }, [audioEnabled]);

  useEffect(() => {
    loadQuest();
  }, [user.studentId]);

  // Typing effect for story
  useEffect(() => {
    if (gameState === 'STORY' && story) {
      setTypedContent('');
      let index = 0;
      const timer = setInterval(() => {
        if (index < story.content.length) {
          setTypedContent(prev => prev + story.content[index]);
          index++;
          // Play subtle typing sound every 5 characters
          if (index % 5 === 0 && audioEnabled) {
            // Could add typing sound here
          }
        } else {
          clearInterval(timer);
        }
      }, 15);
      return () => clearInterval(timer);
    }
  }, [gameState, story, audioEnabled]);

  const loadQuest = async () => {
    if (!user.studentId) return;
    setMascotEmotion('thinking');
    try {
      const data = await QuestService.generateStory(user.studentId);
      setStory(data);
      setMascotEmotion('happy');
      setGameState('STORY');
    } catch (err) {
      console.error(err);
      setError("Failed to load your quest. Please try again later.");
    }
  };

  const handleAnswer = async (option: string) => {
    if (!story) return;
    playSound('click');
    setSelectedOption(option);
    
    const isCorrect = option === story.quiz[currentQuestion].a;
    
    if (isCorrect) {
      setMascotEmotion('excited');
      setTimeout(() => playSound('yehey'), 200);
    } else {
      setMascotEmotion('thinking');
      playSound('error');
    }
    
    setTimeout(async () => {
      if (isCorrect) {
        setScore(prev => prev + 1);
      }
      
      if (currentQuestion + 1 < story.quiz.length) {
        setCurrentQuestion(prev => prev + 1);
        setSelectedOption(null);
        setMascotEmotion('happy');
      } else {
        setMascotEmotion('celebrating');
        setGameState('VICTORY');
        setShowConfetti(true);
        playSound('yehey');
        // Play victory sound 3 times
        setTimeout(() => playSound('yehey'), 400);
        setTimeout(() => playSound('yehey'), 800);
        
        if (user.studentId) {
          await QuestService.completeQuest(user.studentId);
        }
      }
    }, 1500);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#fdf2f8] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl text-center max-w-md">
          <div className="text-6xl mb-4 animate-bounce">😅</div>
          <p className="text-red-500 font-bold uppercase tracking-widest mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-pink-500 text-white px-8 py-3 rounded-full font-black hover:bg-pink-600 transition-all"
          >
            Try Again! 🔄
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf2f8] via-pink-50 to-purple-50 p-4 md:p-6 flex flex-col items-center">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(236, 72, 153, 0.3); }
          50% { box-shadow: 0 0 40px rgba(236, 72, 153, 0.6); }
        }
        .animate-bounce-gentle {
          animation: bounce-gentle 2s ease-in-out infinite;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .animate-pop {
          animation: pop 0.3s ease-out;
        }
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
      `}</style>
      
      {/* Floating stars background */}
      <FloatingStars />
      
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-4 relative z-10">
        <Link 
          to="/portal" 
          onClick={() => playSound('click')} 
          className="text-gray-400 hover:text-pink-500 flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-widest bg-white px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:-translate-y-0.5"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-all text-pink-500"
          >
            {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <div className="bg-white px-4 py-2 rounded-full shadow-sm text-pink-500 font-black text-xs uppercase tracking-widest border border-pink-100 animate-bounce-gentle">
            🌱 Daily Quest
          </div>
        </div>
      </div>

      {/* Score Display */}
      {gameState === 'QUIZ' && (
        <div className="w-full max-w-2xl mb-4 flex justify-center">
          <div className="bg-white px-6 py-3 rounded-full shadow-sm border-2 border-yellow-200 flex items-center gap-3 animate-bounce-gentle">
            <Sparkles className="text-yellow-500" size={20} />
            <span className="font-black text-gray-800">Score: {score}</span>
            <Star className="text-yellow-500 fill-yellow-500" size={20} />
          </div>
        </div>
      )}

      {/* GAME CONTAINER */}
      <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl shadow-pink-200/50 border-4 border-pink-100 overflow-hidden min-h-[600px] relative">
        {showConfetti && <Confetti />}
        
        {/* STATE: LOADING */}
        {gameState === 'LOADING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-white to-pink-50">
            <Mascot emotion="thinking" />
            <p className="text-gray-500 font-black uppercase tracking-widest text-sm mt-8 animate-pulse">
              ✨ Magic happening...
            </p>
            <div className="mt-6 flex gap-2">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i}
                  className="w-3 h-3 bg-pink-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* STATE: STORY READING */}
        {gameState === 'STORY' && story && (
          <div className="p-6 md:p-10 relative">
            <div className="flex flex-col items-center mb-6">
              <Mascot emotion={mascotEmotion} />
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black text-gray-800 mb-6 uppercase tracking-tight leading-tight text-center">
              {story.title}
            </h1>
            
            <div className="bg-pink-50/50 p-6 rounded-2xl mb-6 border-2 border-pink-100">
              <p className="font-medium text-gray-700 text-base md:text-lg leading-relaxed">
                {typedContent}
                <span className="animate-pulse">|</span>
              </p>
            </div>
            
            <button 
              onClick={() => { playSound('click'); setMascotEmotion('excited'); setGameState('QUIZ'); }}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-5 rounded-2xl font-black text-base hover:from-pink-600 hover:to-purple-600 transition-all shadow-xl shadow-pink-200 hover:shadow-2xl uppercase tracking-widest hover:-translate-y-1 active:translate-y-0 animate-glow group"
            >
              <span className="flex items-center justify-center gap-2">
                I'm Ready! 🚀
                <Sparkles className="group-hover:animate-spin" size={20} />
              </span>
            </button>
          </div>
        )}

        {/* STATE: QUIZ */}
        {gameState === 'QUIZ' && story && (
          <div className="p-6 md:p-10 relative">
            {/* Mascot */}
            <div className="flex justify-center mb-4">
              <Mascot emotion={mascotEmotion} />
            </div>

            {/* Progress Bar */}
            <ProgressBar current={currentQuestion} total={story.quiz.length} />
            
            <div className="flex justify-between text-gray-500 text-xs font-black uppercase tracking-widest mb-6">
              <span className="bg-pink-100 px-3 py-1 rounded-full text-pink-600">
                Question {currentQuestion + 1} of {story.quiz.length}
              </span>
              <span className="bg-yellow-100 px-3 py-1 rounded-full text-yellow-700">
                ⭐ {score} points
              </span>
            </div>
            
            <h2 className="text-xl md:text-2xl font-black text-gray-800 mb-8 leading-tight text-center">
              {story.quiz[currentQuestion].q}
            </h2>

            <div className="space-y-3">
              {story.quiz[currentQuestion].options.map((opt, idx) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  onMouseEnter={() => setHoveredOption(opt)}
                  onMouseLeave={() => setHoveredOption(null)}
                  disabled={selectedOption !== null}
                  className={`w-full p-5 rounded-2xl border-3 text-left font-bold text-base transition-all relative transform
                    ${selectedOption === opt 
                      ? (opt === story.quiz[currentQuestion].a 
                        ? 'border-green-400 bg-green-50 text-green-700 scale-105 animate-pop' 
                        : 'border-red-400 bg-red-50 text-red-700 animate-shake')
                      : hoveredOption === opt 
                        ? 'border-pink-300 bg-pink-50 text-pink-700 scale-[1.02] shadow-lg'
                        : 'border-gray-100 hover:border-pink-200 hover:bg-pink-50 text-gray-700 hover:scale-[1.01] hover:shadow-md'}
                    ${selectedOption !== null && selectedOption !== opt ? 'opacity-50' : ''}
                  `}
                  style={{ 
                    transitionDelay: `${idx * 50}ms`,
                    borderWidth: '3px'
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white border-2 border-current flex items-center justify-center text-sm">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </span>
                  {selectedOption === opt && opt === story.quiz[currentQuestion].a && (
                    <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 animate-bounce" size={28} />
                  )}
                  {selectedOption === opt && opt !== story.quiz[currentQuestion].a && (
                    <XCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 animate-shake" size={28} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STATE: VICTORY */}
        {gameState === 'VICTORY' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-white via-green-50 to-pink-50">
            <div className="relative mb-6">
              <Mascot emotion="celebrating" />
              <div className="absolute -inset-4 bg-yellow-200 rounded-full blur-xl opacity-50 animate-pulse" />
            </div>
            
            <h2 className="text-3xl md:text-5xl font-black text-gray-800 mb-2 uppercase tracking-tighter animate-bounce-gentle">
              🎉 Amazing! 🎉
            </h2>
            <p className="text-gray-500 mb-6 font-medium text-sm uppercase tracking-widest">
              You grew your faith plant today!
            </p>
            
            <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-yellow-200 w-full max-w-sm mb-6 transform hover:scale-105 transition-transform">
              <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-2">Your Rewards</p>
              <div className="flex items-center justify-center gap-2">
                <Star className="text-yellow-400 fill-yellow-400 animate-spin" style={{ animationDuration: '2s' }} size={32} />
                <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                  +5
                </p>
                <Star className="text-yellow-400 fill-yellow-400 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} size={32} />
              </div>
              <p className="text-sm text-gray-600 font-bold mt-2">Stars Earned!</p>
            </div>

            <div className="bg-green-100 px-6 py-3 rounded-full mb-6">
              <p className="text-green-700 font-black text-sm">
                Score: {score}/{story?.quiz.length} Correct! 🌟
              </p>
            </div>

            <Link to="/portal">
              <button 
                onClick={() => playSound('click')} 
                className="bg-gradient-to-r from-pink-500 to-purple-500 text-white py-4 px-12 rounded-full font-black shadow-2xl shadow-pink-200 hover:shadow-pink-300 uppercase tracking-widest text-sm transition-all hover:-translate-y-2 hover:scale-105 active:translate-y-0 group"
              >
                <span className="flex items-center gap-2">
                  Collect & Continue 
                  <Sparkles className="group-hover:animate-spin" size={20} />
                </span>
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Footer decoration */}
      <div className="mt-6 flex gap-4 text-3xl animate-bounce-gentle">
        <span>🌈</span>
        <span>✨</span>
        <span>🌟</span>
        <span>✨</span>
        <span>🌈</span>
      </div>
    </div>
  );
};

export default DailyQuestPage;
