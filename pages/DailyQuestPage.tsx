import React, { useState, useEffect } from 'react';
import { Droplets, BookOpen, ScrollText, ChevronLeft, Info } from 'lucide-react';
import { QuestService, QuestStory } from '../services/quest.service';
import { audio } from '../services/audio.service';
import MemoryVersePage from './MemoryVersePage';

interface DailyQuestPageProps {
  user?: any;
}

const DailyQuestPage: React.FC<DailyQuestPageProps> = ({ user }) => {
  const [waterAmount, setWaterAmount] = useState(58);
  const [growthProgress, setGrowthProgress] = useState(31.05);
  const [story, setStory] = useState<QuestStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showMemoryVerse, setShowMemoryVerse] = useState(false);

  const targetGrowth = 60.00;

  useEffect(() => {
    loadStory();
  }, [user]);

  const loadStory = async () => {
    try {
      setLoading(true);
      setError(null);
      const studentId = user?.studentId || 'GUEST_DEMO';
      const questStory = await QuestService.generateStory(studentId);
      setStory(questStory);
    } catch (err) {
      setError('Failed to load story. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTreeImage = () => {
    if (growthProgress < 20) return 'https://cdn-icons-png.flaticon.com/512/628/628283.png';
    if (growthProgress < 50) return 'https://cdn-icons-png.flaticon.com/512/1047/1047610.png';
    return 'https://cdn-icons-png.flaticon.com/512/489/489969.png';
  };

  const handleWatering = () => {
    if (waterAmount >= 10) {
      setWaterAmount(prev => prev - 10);
      setGrowthProgress(prev => Math.min(prev + 2.5, targetGrowth));
      audio.playClick();
    } else {
      alert("Kulang ang iyong tubig! Tapusin ang Bible Story o Memory Verse.");
    }
  };

  const startQuiz = () => {
    setShowQuiz(true);
    setCurrentQuizIndex(0);
    setScore(0);
  };

  const handleQuizAnswer = (answer: string) => {
    if (!story) return;

    if (answer === story.quiz[currentQuizIndex].a) {
      setScore(prev => prev + 1);
      audio.playYehey();
    } else {
      audio.playClick();
    }

    if (currentQuizIndex < story.quiz.length - 1) {
      setCurrentQuizIndex(prev => prev + 1);
    } else {
      setShowQuiz(false);
      setWaterAmount(prev => prev + 20);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-300 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-xl font-bold">Loading Wave 1...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-sky-300 flex items-center justify-center">
        <div className="text-center bg-white rounded-lg p-8 max-w-md">
          <p className="text-red-500 text-xl font-bold mb-4">Oops! The magic didn't work</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadStory}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (showMemoryVerse) {
    return (
      <MemoryVersePage onClose={() => setShowMemoryVerse(false)} />
    );
  }

  if (showQuiz && story) {
    const currentQuestion = story.quiz[currentQuizIndex];
    if (!currentQuestion) return null;

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-400 to-green-400 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">Question {currentQuizIndex + 1} of {story.quiz.length}</span>
              <span className="text-sm text-gray-500">Score: {score}</span>
            </div>
            <h3 className="text-xl font-bold mb-6">{currentQuestion.q}</h3>
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleQuizAnswer(option)}
                  className="w-full text-left p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-300 relative overflow-y-auto max-h-screen">
      <div className="absolute bottom-0 w-full h-[40%] bg-green-300 rounded-t-[300px] transform scale-x-150"></div>

      <div className="relative z-10 p-4">
        <header className="flex justify-between items-center mb-8">
          <button className="bg-white bg-opacity-30 p-3 rounded-full">
            <ChevronLeft color="white" size={28} />
          </button>
          <div className="bg-black bg-opacity-20 px-4 py-2 rounded-full flex items-center">
            <Info color="white" size={16} />
            <span className="text-white font-bold ml-2">Faith Policy</span>
          </div>
        </header>

        <div className="absolute left-5 top-32 text-center">
          <button
            onClick={() => {
              const element = document.getElementById('story-content');
              if (element) element.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-white p-3 rounded-full border-4 border-blue-500 shadow-lg mb-2"
          >
            <BookOpen color="#3b82f6" size={30} />
          </button>
          <p className="text-blue-800 font-bold">Bible Story</p>
        </div>

        <div className="absolute right-5 top-32 text-center">
          <button
            onClick={() => setShowMemoryVerse(true)}
            className="bg-white p-3 rounded-full border-4 border-purple-500 shadow-lg mb-2"
          >
            <ScrollText color="#a855f7" size={30} />
          </button>
          <p className="text-purple-800 font-bold">Verse</p>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <img
            src={getTreeImage()}
            alt="Tree"
            className="w-64 h-64 mb-5 object-contain"
          />

          <div className="text-center">
            <div className="w-52 h-4 bg-gray-200 rounded-full overflow-hidden border-2 border-white mb-2">
              <div
                className="h-full bg-yellow-400 transition-all duration-300"
                style={{ width: `${(growthProgress / targetGrowth) * 100}%` }}
              ></div>
            </div>
            <p className="text-white font-bold text-lg">
              {growthProgress.toFixed(2)} / {targetGrowth.toFixed(2)}
            </p>
          </div>
        </div>

        {story && (
          <div id="story-content" className="max-w-2xl mx-auto mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4 text-center">{story.title}</h2>
              <p className="text-gray-700 mb-6 text-center">{story.content}</p>
              <button
                onClick={startQuiz}
                className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors font-bold"
              >
                Start Quiz
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-end p-4">
          <div className="text-center">
            <div className="bg-white px-4 py-2 rounded-full mb-1">
              <p className="text-green-700 font-bold">Invite</p>
            </div>
          </div>

          <div className="text-center">
            <div className="bg-green-100 px-3 py-1 rounded-full mb-1 border border-green-500">
              <p className="text-green-700 font-bold">{waterAmount}ml</p>
            </div>
            <button
              onClick={handleWatering}
              className="bg-orange-500 p-5 rounded-full border-4 border-white shadow-lg"
            >
              <Droplets color="white" size={40} />
            </button>
            <p className="text-white font-bold mt-1">Water Tree</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyQuestPage;