import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

// Mock Data (Replace this with your actual Gemini/Supabase data fetching later)
const MOCK_STORY = {
  title: "David: The Brave Shepherd",
  content: "Long ago, there was a young shepherd boy named David. While his brothers were soldiers, David protected sheep. One day, a giant bear attacked his flock! David didn't run. He trusted God, used his sling, and saved the sheep. He learned that with God, even the small can be mighty.",
  quiz: [
    { q: "What was David's job?", options: ["Soldier", "Shepherd", "King"], a: "Shepherd" },
    { q: "What animal attacked?", options: ["Lion", "Bear", "Wolf"], a: "Bear" },
    { q: "Who did David trust?", options: ["His muscles", "God", "His sword"], a: "God" }
  ]
};

export default function DailyQuest() {
  const [gameState, setGameState] = useState('LOADING'); // LOADING, STORY, QUIZ, VICTORY
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  
  // Simulate loading the AI Story
  useEffect(() => {
    setTimeout(() => setGameState('STORY'), 2000); // Fake 2s load time
  }, []);

  const handleAnswer = (option) => {
    setSelectedOption(option);
    const isCorrect = option === MOCK_STORY.quiz[currentQuestion].a;
    
    setTimeout(() => {
      if (isCorrect) setScore(score + 1);
      
      if (currentQuestion + 1 < MOCK_STORY.quiz.length) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedOption(null);
      } else {
        setGameState('VICTORY');
        // TODO: Insert Code here to update Supabase (water the plant)
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
      
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-pink-500 flex items-center gap-2">
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>
        <div className="bg-white px-4 py-2 rounded-full shadow-sm text-pink-500 font-bold">
          🌱 Daily Quest
        </div>
      </div>

      {/* GAME CONTAINER */}
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden min-h-[500px] relative">
        
        {/* STATE: LOADING */}
        {gameState === 'LOADING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="animate-bounce text-6xl">✨</div>
            <p className="mt-4 text-gray-400 font-medium">Generating today's story...</p>
          </div>
        )}

        {/* STATE: STORY READING */}
        {gameState === 'STORY' && (
          <div className="p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">{MOCK_STORY.title}</h1>
            <div className="prose prose-pink text-lg text-gray-600 leading-relaxed">
              {MOCK_STORY.content}
            </div>
            <button 
              onClick={() => setGameState('QUIZ')}
              className="mt-8 w-full bg-pink-500 text-white py-4 rounded-xl font-bold text-xl hover:bg-pink-600 transition-all shadow-lg transform hover:scale-[1.02]"
            >
              I'm Ready for the Quiz! 🚀
            </button>
          </div>
        )}

        {/* STATE: QUIZ */}
        {gameState === 'QUIZ' && (
          <div className="p-8">
            <div className="flex justify-between text-gray-400 text-sm mb-6">
              <span>Question {currentQuestion + 1} of {MOCK_STORY.quiz.length}</span>
              <span>Score: {score}</span>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-8">
              {MOCK_STORY.quiz[currentQuestion].q}
            </h2>

            <div className="space-y-4">
              {MOCK_STORY.quiz[currentQuestion].options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  disabled={selectedOption !== null}
                  className={`w-full p-4 rounded-xl border-2 text-left font-semibold transition-all
                    ${selectedOption === opt 
                      ? (opt === MOCK_STORY.quiz[currentQuestion].a ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700')
                      : 'border-gray-100 hover:border-pink-300 hover:bg-pink-50 text-gray-600'}
                  `}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STATE: VICTORY */}
        {gameState === 'VICTORY' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-white to-green-50">
            <div className="text-8xl mb-4">🌳</div>
            <h2 className="text-4xl font-bold text-gray-800 mb-2">You Flourished!</h2>
            <p className="text-gray-500 mb-8">You watered your plant and grew closer to God today.</p>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 w-full mb-8">
              <p className="text-sm text-gray-400 uppercase">Total XP Gained</p>
              <p className="text-3xl font-bold text-green-500">+50 XP</p>
            </div>

            <Link href="/dashboard">
              <button className="bg-pink-500 text-white py-3 px-8 rounded-xl font-bold shadow-lg hover:bg-pink-600">
                Collect Rewards & Exit
              </button>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}