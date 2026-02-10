import React, { useState, useEffect } from 'react';
import { ChevronLeft, Clock, CheckCircle, XCircle } from 'lucide-react';
import { audio } from '../services/audio.service';

interface MemoryVersePageProps {
  onClose?: () => void;
}

const MemoryVersePage: React.FC<MemoryVersePageProps> = ({ onClose }) => {
  const [verse, setVerse] = useState('');
  const [translation, setTranslation] = useState('');
  const [showVerse, setShowVerse] = useState(false);
  const [currentWave, setCurrentWave] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const startGame = () => {
    if (verse && translation) {
      setShowVerse(true);
      setGameStarted(true);
      audio.playClick();
    }
  };

  const generateQuestion = () => {
    const questions = {
      1: [
        "How many words are in this verse?",
        "What is the first word of the verse?",
        "What is the last word of the verse?",
        "What book is this verse from?",
        "What is the main theme of this verse?",
        "How many times does the word 'God' appear?",
        "What is the third word of the verse?",
        "Is this verse from the Old or New Testament?",
        "What punctuation marks are in this verse?",
        "What is the shortest word in this verse?"
      ],
      2: [
        "Unscramble these words: [scrambled phrase]",
        "What comes after '[first half]'?",
        "What comes before '[second half]'?",
        "How many commas are in this verse?",
        "What is the middle word of this verse?",
        "Fill in the blank: '[partial] ___ [partial]'",
        "What is the main verb in this verse?",
        "How many sentences are in this verse?",
        "What word appears twice in this verse?",
        "Arrange these words in order: [mixed words]"
      ],
      3: [
        "Which word doesn't belong: [words with imposter]",
        "Fix the typo: '[verse with error]'",
        "Which words should be capitalized?",
        "Fill in the missing vowels: '[consonants only]'",
        "Spot the incorrect word: [verse with wrong word]",
        "What punctuation is missing?",
        "Which word is misspelled?",
        "Correct the capitalization: '[wrong case]'",
        "Find the extra word: [verse with extra word]",
        "What's wrong with this verse: '[error verse]'"
      ],
      4: [
        "What does this verse mean in your own words?",
        "What is the context of this verse?",
        "Why is this verse important?",
        "How does this verse apply to daily life?",
        "What is the key message here?",
        "Who is speaking in this verse?",
        "What is the historical setting?",
        "What other verses relate to this?",
        "What promise is made in this verse?",
        "What command is given in this verse?"
      ],
      5: [
        "Recite the first half from memory",
        "Recite the second half from memory",
        "Write the entire verse from memory",
        "Recite it backwards (mirror mode)",
        "What comes before verse [reference]?",
        "What comes after verse [reference]?",
        "Recite without looking",
        "Perfect transcript challenge",
        "Speed recitation challenge",
        "Final mastery test"
      ]
    };

    const waveQuestions = questions[currentWave as keyof typeof questions] || questions[1];
    return waveQuestions[currentQuestion - 1] || "Question not available";
  };

  const submitAnswer = () => {
    setShowFeedback(true);
    audio.playClick();
    
    // Simple scoring logic (in real app, this would be more sophisticated)
    const isCorrect = Math.random() > 0.3; // Mock 70% success rate
    if (isCorrect) {
      setScore(prev => prev + 1);
      setFeedback("✅ Correct! Well done!");
      audio.playYehey();
    } else {
      setFeedback(`❌ Not quite. The verse is: "${verse}"`);
    }

    setTimeout(() => {
      setShowFeedback(false);
      setUserAnswer('');
      if (currentQuestion < totalQuestions) {
        setCurrentQuestion(prev => prev + 1);
      } else {
        // Wave complete
        if (score >= 8) {
          if (currentWave < 5) {
            setCurrentWave(prev => prev + 1);
            setCurrentQuestion(1);
            setScore(0);
          } else {
            // Game complete
            alert("🎉 Mastery Complete! You've memorized the verse!");
          }
        } else {
          alert("❌ Need 8/10 to advance. Try again!");
          setCurrentQuestion(1);
          setScore(0);
        }
      }
    }, 3000);
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <button onClick={onClose} className="text-white">
              <ChevronLeft size={32} />
            </button>
            <h1 className="text-3xl font-bold text-white">Memory Vault Sentinel</h1>
            <div className="w-8"></div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Scripture Memory Challenge</h2>
            
            <div className="mb-6">
              <label className="block text-gray-700 font-bold mb-2">Verse Reference:</label>
              <input
                type="text"
                value={verse}
                onChange={(e) => setVerse(e.target.value)}
                placeholder="e.g., John 3:16"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-bold mb-2">Translation:</label>
              <input
                type="text"
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder="e.g., NIV, ESV, KJV"
                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-bold mb-2">Full Verse Text:</label>
              <textarea
                value={verse}
                onChange={(e) => setVerse(e.target.value)}
                placeholder="Enter the complete verse text..."
                className="w-full p-3 border rounded-lg h-32 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              onClick={startGame}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-bold"
            >
              Begin Challenge
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-purple-800 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <button onClick={onClose} className="text-white">
            <ChevronLeft size={32} />
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Wave {currentWave}</h1>
            <p className="text-purple-200">Question {currentQuestion}/{totalQuestions}</p>
          </div>
          <div className="text-white text-center">
            <p className="text-sm">Score</p>
            <p className="text-xl font-bold">{score}/{totalQuestions}</p>
          </div>
        </div>

        {showVerse && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-bold mb-2 text-center">Your Verse:</h3>
            <p className="text-gray-700 text-center italic">"{verse}"</p>
            <p className="text-sm text-gray-500 text-center mt-2">{translation}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center mb-4">
            <Clock className="text-purple-600 mr-2" size={20} />
            <span className="text-purple-600 font-bold">⏱️ 30 SECONDS ON THE CLOCK</span>
          </div>

          <h3 className="text-xl font-bold mb-6">{generateQuestion()}</h3>

          {!showFeedback ? (
            <>
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-3 border rounded-lg h-24 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
              />
              <button
                onClick={submitAnswer}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition-colors font-bold"
              >
                Submit Answer
              </button>
            </>
          ) : (
            <div className={`text-center p-4 rounded-lg ${feedback.includes('✅') ? 'bg-green-100' : 'bg-red-100'}`}>
              <p className={`text-lg font-bold ${feedback.includes('✅') ? 'text-green-700' : 'text-red-700'}`}>
                {feedback}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemoryVersePage;