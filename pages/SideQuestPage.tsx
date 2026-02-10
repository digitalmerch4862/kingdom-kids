import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserSession } from '../types';
import { audio } from '../services/audio.service';
import { BookOpen, ScrollText, Droplets, ChevronLeft, MoreHorizontal, Waves, Award, Clock, AlertCircle, ChevronRight, Settings, Sparkles } from 'lucide-react';

interface SideQuestPageProps {
  user: UserSession;
}

interface Question {
  id: number;
  question: string;
  options?: string[];
  correctAnswer?: number;
  answer?: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'VERY HARD';
}

// Parse the CSV data into questions
const parseCSVQuestions = (csvData: string): Question[] => {
  const lines = csvData.trim().split('\n');
  const questions: Question[] = [];

  for (const line of lines) {
    if (line.startsWith('day,question')) continue; // Skip header

    const parts = line.split(',');
    if (parts.length >= 7) {
      const [day, question, optionA, optionB, optionC, optionD, correctAnswer] = parts;

      let difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'EASY';
      const dayNum = parseInt(day);
      if (dayNum >= 3 && dayNum <= 4) difficulty = 'MEDIUM';
      else if (dayNum >= 5) difficulty = 'HARD';

      questions.push({
        id: parseInt(day) * 1000 + questions.length,
        question: question.replace(/"/g, ''),
        options: [optionA, optionB, optionC, optionD].map(opt => opt.replace(/"/g, '')),
        correctAnswer: correctAnswer.toUpperCase().charCodeAt(0) - 65, // Convert A/B/C/D to 0/1/2/3
        difficulty: difficulty
      });
    }
  }

  return questions;
};

// All questions from the CSV data
const allQuestionsCSV = `day,question,option_a,option_b,option_c,option_d,correct_answer
1,Who created the world?,Moses,God,Noah,Adam,B
1,Who was the first man?,Noah,Abraham,Adam,David,C
1,Who was the first woman?,Sarah,Mary,Eve,Ruth,C
1,What garden did Adam and Eve live in?,Eden,Babylon,Egypt,Jericho,A
1,Who built the ark?,Moses,Noah,Jonah,Paul,B
1,Why did Noah build the ark?,For travel,For animals and family,For war,For fun,B
1,What covered the earth during Noah's time?,Fire,Wind,Flood,Snow,C
1,Who led Israel out of Egypt?,Joseph,David,Moses,Joshua,C
1,Who is God's Son?,Moses,Elijah,Jesus,Samuel,C
2,Who was Abraham's son?,Isaac,Jacob,Joseph,Moses,A
2,What did God promise Abraham?,Gold,Many children,A house,A city,B
2,Who had a coat of many colors?,Jacob,Joseph,David,Solomon,B
2,Who was swallowed by a big fish?,Peter,Jonah,Paul,John,B
2,Who was Moses' brother?,Aaron,Joseph,Joshua,Caleb,A
2,What sea did God part?,Red Sea,Dead Sea,Jordan Sea,Blue Sea,A
2,Who received the Ten Commandments?,Abraham,Moses,David,Samuel,B
2,What mountain did Moses climb?,Sinai,Ararat,Zion,Carmel,A
2,Who fought Goliath?,Saul,David,Jonathan,Samson,B
2,What was Goliath?,King,Giant,Prophet,Angel,B
3,What did David use to defeat Goliath?,Sword,Rock and sling,Spear,Bow,B
3,Who was the strongest man?,David,Samson,Solomon,Saul,B
3,What made Samson strong?,Hair,Crown,Sword,Shoes,A
3,Who cut Samson's hair?,Ruth,Delilah,Esther,Mary,B
3,Who became king after Saul?,Solomon,David,Samuel,Jonathan,B
3,Who built the temple?,David,Solomon,Saul,Hezekiah,B
3,What animal stopped Balaam?,Horse,Donkey,Camel,Ox,B
3,Who was thrown into a lions' den?,Joseph,Daniel,Jonah,Peter,B
3,Who saved Daniel?,Angel,King,Soldier,Friend,A
3,Who became queen to save her people?,Ruth,Esther,Deborah,Mary,B
4,Who was Esther's cousin?,Mordecai,David,Nehemiah,Ezra,A
4,What city had walls fall down?,Jericho,Bethlehem,Jerusalem,Nazareth,A
4,Who led the people around Jericho?,Joshua,Moses,Caleb,Samuel,A
4,What instrument did they blow?,Drum,Trumpet,Harp,Flute,B
4,Who was known for wisdom?,David,Solomon,Saul,Elijah,B
4,What book has many wise sayings?,Genesis,Psalms,Proverbs,Exodus,C
4,Who was taken to heaven in a chariot of fire?,Elisha,Elijah,Moses,Isaiah,B
4,Who followed Elijah?,Elisha,Samuel,David,Jeremiah,A
4,Who interpreted dreams in Egypt?,Joseph,Moses,Daniel,Jacob,A
4,Who forgave his brothers?,Joseph,David,Saul,Noah,A
5,Who was Jesus' mother?,Mary,Elizabeth,Martha,Ruth,A
5,Where was Jesus born?,Nazareth,Bethlehem,Jerusalem,Egypt,B
5,Who was Jesus' earthly father?,Peter,Joseph,John,Paul,B
5,Who visited baby Jesus?,Shepherds only,Kings only,Shepherds and wise men,Soldiers,C
5,What guided the wise men?,Star,Angel,Cloud,Fire,A
5,Who baptized Jesus?,Peter,John the Baptist,Paul,James,B
5,What animal did Jesus ride into Jerusalem?,Horse,Donkey,Camel,Ox,B
5,What did Jesus turn water into?,Milk,Juice,Wine,Honey,C
5,How many disciples did Jesus have?,10,11,12,13,C
5,Who betrayed Jesus?,Peter,John,Judas,Matthew,C
6,What did Jesus feed 5,000 people with?,Bread only,Fish only,Bread and fish,Meat and bread,C
6,Who walked on water?,Peter,Jesus,John,Andrew,B
6,Who denied Jesus three times?,John,James,Peter,Paul,C
6,Who helped Jesus carry the cross?,Simon of Cyrene,Peter,John,Joseph,A
6,Where was Jesus crucified?,Bethlehem,Golgotha,Nazareth,Jericho,B
6,What happened on the third day?,Jesus slept,Jesus rose,Jesus left,Jesus hid,B
6,Who found the empty tomb?,Soldiers,Disciples,Women,Pharisees,C
6,Who rolled the stone away?,Angel,Disciple,Soldier,King,A
6,Who doubted Jesus rose?,Thomas,Peter,James,John,A
6,What did Jesus say we should do to others?,Ignore them,Love them,Judge them,Avoid them,B
7,Who wrote many Psalms?,David,Solomon,Moses,Asaph,A
7,What is the Bible?,Storybook,God's Word,Songbook,Poem,B
7,Who was the first missionary?,Paul,Peter,Jesus,Philip,A
7,Who was blinded on the road to Damascus?,Peter,Paul,John,James,B
7,Who healed the sick?,Peter only,Jesus only,Paul only,Many with God's power,D
7,Who taught using parables?,Moses,Jesus,David,Solomon,B
7,What is a parable?,Song,Story with lesson,Prayer,Command,B
7,Who calmed the storm?,Peter,Jesus,Jonah,Paul,B
7,Who is called the Good Shepherd?,David,Moses,Jesus,Abraham,C
7,What should we do to our enemies?,Hate them,Avoid them,Love them,Ignore them,C`;

// Parse all questions
const allQuestions = parseCSVQuestions(allQuestionsCSV);

// Memory Verse Questions
const memoryVerseQuestions: Question[] = [
  // Easy
  { id: 1001, question: 'Which verse says "The Lord is my light and my salvation"?', options: ['Psalm 27:1', 'Psalm 23:1', 'Psalm 119:105', 'Psalm 46:1'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1002, question: 'Which verse says "Be kind to one another"?', options: ['Galatians 5:22', 'Ephesians 4:32', 'Colossians 3:12', '1 Peter 4:8'], correctAnswer: 1, difficulty: 'EASY' },
  { id: 1003, question: 'Which verse says "Give thanks in all circumstances"?', options: ['Psalm 107:1', '1 Thessalonians 5:18', 'Ephesians 5:20', 'Colossians 3:17'], correctAnswer: 1, difficulty: 'EASY' },
  { id: 1004, question: 'Which verse says "Jesus wept"?', options: ['John 11:35', 'Luke 19:41', 'Matthew 14:14', 'Mark 1:41'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1005, question: 'Which verse says "The Lord is faithful"?', options: ['1 Corinthians 1:9', '2 Thessalonians 3:3', 'Deuteronomy 7:9', 'Psalm 119:90'], correctAnswer: 1, difficulty: 'EASY' },
  { id: 1006, question: 'Which verse says "Let everything that has breath praise the Lord"?', options: ['Psalm 150:6', 'Psalm 103:22', 'Psalm 145:21', 'Psalm 148:7'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1007, question: 'Which verse says "Love is patient, love is kind"?', options: ['John 3:16', '1 Corinthians 13:4', '1 John 4:8', 'Romans 13:10'], correctAnswer: 1, difficulty: 'EASY' },
  { id: 1008, question: 'Which verse says "The Lord is close to the brokenhearted"?', options: ['Psalm 34:18', 'Psalm 51:17', 'Psalm 147:3', 'Isaiah 57:15'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1009, question: 'Which verse says "Serve the Lord with gladness"?', options: ['Psalm 100:2', 'Psalm 2:11', 'Deuteronomy 28:47', 'Colossians 3:23'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1010, question: 'Which verse says "Do not worry about tomorrow"?', options: ['Matthew 6:34', 'Philippians 4:6', '1 Peter 5:7', 'Proverbs 3:5'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1011, question: 'Which verse says "The Lord bless you and keep you"?', options: ['Numbers 6:24', 'Psalm 5:12', 'Genesis 12:2', 'Deuteronomy 28:1'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1012, question: 'Which verse says "A gentle answer turns away wrath"?', options: ['Proverbs 15:1', 'Proverbs 15:18', 'Proverbs 29:11', 'Ecclesiastes 10:4'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1013, question: 'Which verse says "This is the day the Lord has made"?', options: ['Psalm 118:24', 'Psalm 100:4', 'Deuteronomy 32:4', 'Isaiah 12:5'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1014, question: 'Which verse says "The Lord is good"?', options: ['Psalm 34:8', 'Psalm 100:5', 'Nahum 1:7', 'Psalm 25:8'], correctAnswer: 0, difficulty: 'EASY' },
  { id: 1015, question: 'Which verse says "Be joyful always"?', options: ['1 Thessalonians 5:16', 'Habakkuk 3:18', 'Psalm 16:11', 'Philippians 4:4'], correctAnswer: 0, difficulty: 'EASY' },
  // Medium
  { id: 2001, question: 'Which verse says "Those who trust in the Lord are like Mount Zion"?', options: ['Psalm 125:1', 'Psalm 48:1', 'Psalm 87:1', 'Psalm 133:3'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2002, question: 'Which verse says "Do not let your hearts be troubled"?', options: ['John 14:1', 'John 14:27', 'Isaiah 26:3', 'Philippians 4:6'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2003, question: 'Which verse says "Let us love one another"?', options: ['1 John 4:7', 'John 13:34', '1 Peter 1:22', 'Romans 12:10'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2004, question: 'Which verse says "A cheerful giver loves God"?', options: ['2 Corinthians 9:7', 'Proverbs 22:9', 'Luke 21:1', 'Matthew 6:2'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2005, question: 'Which verse says "The Lord is my strength and my shield"?', options: ['Psalm 28:7', 'Psalm 119:114', 'Psalm 18:2', 'Psalm 3:3'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2006, question: 'Which verse says "Forgive as the Lord forgave you"?', options: ['Colossians 3:13', 'Ephesians 4:32', 'Matthew 6:14', 'Mark 11:25'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2007, question: 'Which verse says "Blessed is the one who trusts in the Lord"?', options: ['Jeremiah 17:7', 'Psalm 34:8', 'Proverbs 16:20', 'Psalm 84:12'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2008, question: 'Which verse says "Be imitators of God"?', options: ['Ephesians 5:1', 'Matthew 5:48', '1 Peter 1:16', 'Leviticus 19:2'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2009, question: 'Which verse says "The harvest is plentiful"?', options: ['Matthew 9:37', 'John 4:35', 'Galatians 6:9', '2 Timothy 2:6'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2010, question: 'Which verse says "Do not grow weary in doing good"?', options: ['Galatians 6:9', 'Isaiah 40:31', '1 Corinthians 15:58', 'Psalm 37:25'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2011, question: 'Which verse says "Set your hearts on things above"?', options: ['Colossians 3:1', 'Romans 8:5', 'Philippians 3:19', 'Matthew 6:21'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2012, question: 'Which verse says "The Lord will fight for you"?', options: ['Exodus 14:14', 'Deuteronomy 1:30', 'Joshua 23:10', 'Nehemiah 4:20'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2013, question: 'Which verse says "Taste and see that the Lord is good"?', options: ['Psalm 34:8', 'Psalm 119:103', '1 Peter 2:3', 'Exodus 3:8'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2014, question: 'Which verse says "Let the peace of Christ rule in your hearts"?', options: ['Colossians 3:15', 'John 14:27', 'Isaiah 9:6', 'Romans 15:33'], correctAnswer: 0, difficulty: 'MEDIUM' },
  { id: 2015, question: 'Which verse says "Humble yourselves before the Lord"?', options: ['James 4:10', '1 Peter 5:6', 'Micah 6:8', 'Proverbs 22:4'], correctAnswer: 0, difficulty: 'MEDIUM' },
  // Hard
  { id: 3001, question: 'Which verse says "The Lord knows the plans I have for you"?', options: ['Jeremiah 29:11', 'Psalm 139:16', 'Romans 8:28', 'Ephesians 2:10'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3002, question: 'Which verse says "Be transformed by the renewing of your mind"?', options: ['Romans 12:2', 'Ephesians 4:23', 'Colossians 3:10', 'Titus 3:5'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3003, question: 'Which verse says "We love because He first loved us"?', options: ['1 John 4:19', '1 John 4:10', 'Romans 5:5', 'John 3:16'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3004, question: 'Which verse says "The Lord is slow to anger and rich in love"?', options: ['Psalm 103:8', 'Numbers 14:18', 'Nehemiah 9:17', 'Joel 2:13'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3005, question: 'Which verse says "The battle belongs to the Lord"?', options: ['1 Samuel 17:47', '2 Chronicles 20:15', 'Psalm 44:5', 'Deuteronomy 20:4'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3006, question: 'Which verse says "Let us run with perseverance the race marked out for us"?', options: ['Hebrews 12:1', '1 Corinthians 9:24', '2 Timothy 4:7', 'Philippians 3:14'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3007, question: 'Which verse says "For we are God\'s workmanship"?', options: ['Ephesians 2:10', 'Psalm 139:14', 'Isaiah 43:7', 'Colossians 1:16'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3008, question: 'Which verse says "Your faith has made you well"?', options: ['Mark 5:34', 'Matthew 9:22', 'Luke 17:19', 'Luke 8:48'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3009, question: 'Which verse says "Be devoted to one another in love"?', options: ['Romans 12:10', 'John 13:34', '1 John 3:23', 'Galatians 5:13'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3010, question: 'Which verse says "The Lord will never forsake you"?', options: ['Deuteronomy 31:6', 'Isaiah 41:17', 'Psalm 37:25', 'Hebrews 13:5'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3011, question: 'Which verse says "The righteous cry out, and the Lord hears them"?', options: ['Psalm 34:17', 'Psalm 145:19', 'Psalm 10:17', 'Proverbs 15:29'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3012, question: 'Which verse says "Let us not love with words or speech but with actions"?', options: ['1 John 3:18', 'James 2:17', 'Titus 3:8', 'Matthew 7:21'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3013, question: 'Which verse says "The Lord is my portion"?', options: ['Lamentations 3:24', 'Psalm 73:26', 'Psalm 16:5', 'Psalm 119:57'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3014, question: 'Which verse says "Do not be overcome by evil, but overcome evil with good"?', options: ['Romans 12:21', 'Matthew 5:39', '1 Peter 3:9', 'Proverbs 25:21'], correctAnswer: 0, difficulty: 'HARD' },
  { id: 3015, question: 'Which verse says "Those who sow with tears will reap with songs of joy"?', options: ['Psalm 126:5', 'Ecclesiastes 11:1', 'Galatians 6:8', 'Isaiah 35:10'], correctAnswer: 0, difficulty: 'HARD' },
  // Very Hard
  { id: 4001, question: 'Which verse says "Who may ascend the mountain of the Lord"?', options: ['Psalm 24:3', 'Psalm 15:1', 'Psalm 27:4', 'Psalm 43:3'], correctAnswer: 0, difficulty: 'VERY HARD' },
  { id: 4002, question: 'Which verse says "The Lord examines the righteous"?', options: ['Psalm 11:5', 'Psalm 11:4', 'Jeremiah 12:3', 'Hebrews 4:13'], correctAnswer: 0, difficulty: 'VERY HARD' },
  { id: 4003, question: 'Which verse says "My times are in your hands"?', options: ['Psalm 31:15', 'Psalm 139:16', 'Psalm 56:3', 'Job 14:5'], correctAnswer: 0, difficulty: 'VERY HARD' },
  { id: 4004, question: 'Which verse says "The Lord detests dishonest scales"?', options: ['Proverbs 11:1', 'Proverbs 20:10', 'Proverbs 16:11', 'Leviticus 19:36'], correctAnswer: 0, difficulty: 'VERY HARD' },
  { id: 4005, question: 'Which verse says "The Lord is compassionate and gracious"?', options: ['Exodus 34:6', 'Psalm 103:8', 'Joel 2:13', 'Jonah 4:2'], correctAnswer: 0, difficulty: 'VERY HARD' },
  { id: 4006, question: 'Which verse says "The Lord reigns forever"?', options: ['Psalm 146:10', 'Exodus 15:18', 'Psalm 93:1', '1 Timothy 1:17'], correctAnswer: 0, difficulty: 'VERY HARD' },
  { id: 4007, question: 'Which verse says "I know whom I have believed"?', options: ['2 Timothy 1:12', 'Acts 20:24', '1 Timothy 1:1', 'Philemon 1:1'], correctAnswer: 0, difficulty: 'VERY HARD' },
  { id: 4008, question: 'Which verse says "The Spirit helps us in our weakness"?', options: ['Romans 8:26', 'Romans 8:15', 'Galatians 5:5', 'Ephesians 6:18'], correctAnswer: 0, difficulty: 'VERY HARD' },
  { id: 4009, question: 'Which verse says "The Lord is my helper; I will not be afraid"?', options: ['Hebrews 13:6', 'Psalm 27:1', 'Psalm 118:6', 'Isaiah 41:10'], correctAnswer: 0, difficulty: 'VERY HARD' },
  { id: 4010, question: 'Which verse says "The Lord will perfect that which concerns me"?', options: ['Psalm 138:8', 'Philippians 1:6', '1 Peter 5:10', 'Isaiah 46:4'], correctAnswer: 0, difficulty: 'VERY HARD' },
];

const QUESTION_TIMER = 30;
const QUESTIONS_PER_WAVE = 10;
const TOTAL_WAVES = 5;

const getVerseDifficulty = (wave: number): 'EASY' | 'MEDIUM' | 'HARD' | 'VERY HARD' => {
  if (wave === 1) return 'EASY';
  if (wave === 2) return 'MEDIUM';
  if (wave === 3) return 'HARD';
  return 'VERY HARD';
};

const getVerseDifficultyLevel = (wave: number): 'EASY' | 'MEDIUM' | 'HARD' | 'VERY HARD' => {
  return getVerseDifficulty(wave);
};

const getMemoryVerseQuestionsForWave = (wave: number, usedQuestionIds: Set<number> = new Set()): Question[] => {
  const difficulty = getVerseDifficultyLevel(wave);

  let pool = memoryVerseQuestions.filter(q =>
    q.difficulty === difficulty && !usedQuestionIds.has(q.id)
  );

  if (pool.length < QUESTIONS_PER_WAVE) {
    const allDifficultyQuestions = memoryVerseQuestions.filter(q => q.difficulty === difficulty);
    const usedQuestions = allDifficultyQuestions.filter(q => usedQuestionIds.has(q.id));

    const additionalQuestions = usedQuestions
      .sort(() => Math.random() - 0.5)
      .slice(0, QUESTIONS_PER_WAVE - pool.length);
    pool = [...pool, ...additionalQuestions];
  }

  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, QUESTIONS_PER_WAVE);
};

const getWaveDifficulty = (wave: number): 'EASY' | 'MEDIUM' | 'HARD' => {
  if (wave <= 2) return 'EASY';
  if (wave <= 4) return 'MEDIUM';
  return 'HARD';
};

const getQuestionsForWave = (wave: number, usedQuestionIds: Set<number> = new Set()): Question[] => {
  const difficulty = getWaveDifficulty(wave);

  // Filter questions by difficulty and unused ones
  let pool = allQuestions.filter(q =>
    q.difficulty === difficulty && !usedQuestionIds.has(q.id)
  );

  // If we don't have enough unused questions, allow some repeats but prioritize unused
  if (pool.length < QUESTIONS_PER_WAVE) {
    const allDifficultyQuestions = allQuestions.filter(q => q.difficulty === difficulty);
    const usedQuestions = allDifficultyQuestions.filter(q => usedQuestionIds.has(q.id));

    // Add some used questions to meet the requirement
    const additionalQuestions = usedQuestions
      .sort(() => Math.random() - 0.5)
      .slice(0, QUESTIONS_PER_WAVE - pool.length);
    pool = [...pool, ...additionalQuestions];
  }

  // Shuffle and take the required number
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, QUESTIONS_PER_WAVE);
};

// Tree stages matching the React Native design
const treeStages = [
  { emoji: '🌱', name: 'Seedling', minProgress: 0, maxProgress: 25 },
  { emoji: '🌿', name: 'Sapling', minProgress: 25, maxProgress: 50 },
  { emoji: '🌳', name: 'Small Tree', minProgress: 50, maxProgress: 75 },
  { emoji: '🌲', name: 'Mature Tree', minProgress: 75, maxProgress: 100 },
];

const getTreeStage = (progress: number) => {
  return treeStages.find(stage => progress >= stage.minProgress && progress < stage.maxProgress) || treeStages[0];
};

const SideQuestPage: React.FC<SideQuestPageProps> = ({ user }) => {
  const [waterAmount, setWaterAmount] = useState(58);
  const [growthProgress, setGrowthProgress] = useState(31);
  const [pointsCollected, setPointsCollected] = useState(31.05);
  const targetPoints = 60.00;

  // Quiz state
  const [currentWave, setCurrentWave] = useState(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMER);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [waveCorrectAnswers, setWaveCorrectAnswers] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showWaveComplete, setShowWaveComplete] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizStarted, setQuizStarted] = useState(false);
  const [activeMode, setActiveMode] = useState<'bible' | 'verse' | null>(null);
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<number>>(new Set());

  const studentId = user.studentId || 'guest';
  const storageKey = `sidequest_${studentId}`;
  const dailyQuestionsKey = `daily_questions_${studentId}_${new Date().toDateString()}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        setWaterAmount(data.waterAmount || 58);
        setGrowthProgress(data.growthProgress || 31);
        setPointsCollected(data.pointsCollected || 31.05);
      }

      // Load today's used question IDs
      const dailyUsed = localStorage.getItem(dailyQuestionsKey);
      if (dailyUsed) {
        const usedIds = JSON.parse(dailyUsed);
        setUsedQuestionIds(new Set(usedIds));
      }
    } catch (e) {
      console.error("Failed to load saved progress", e);
    }
  }, [storageKey, dailyQuestionsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        waterAmount,
        growthProgress,
        pointsCollected,
      }));
    } catch (e) {
      console.error("Failed to save progress", e);
    }
  }, [waterAmount, growthProgress, pointsCollected, storageKey]);

  useEffect(() => {
    try {
      // Save used question IDs for today
      localStorage.setItem(dailyQuestionsKey, JSON.stringify(Array.from(usedQuestionIds)));
    } catch (e) {
      console.error("Failed to save used questions", e);
    }
  }, [usedQuestionIds, dailyQuestionsKey]);

  // Timer effect
  useEffect(() => {
    if (!quizStarted || showResults || showWaveComplete || isAnswered) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, showResults, showWaveComplete, isAnswered, currentQuestionIndex]);

  const handleTimeUp = () => {
    setIsAnswered(true);
    setTimeout(() => {
      nextQuestion();
    }, 1500);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setTimeLeft(QUESTION_TIMER);
    } else {
      setShowWaveComplete(true);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (isAnswered) return;

    setSelectedAnswer(answerIndex);
    setIsAnswered(true);

    if (answerIndex === questions[currentQuestionIndex].correctAnswer) {
      setCorrectAnswers(prev => prev + 1);
      setWaveCorrectAnswers(prev => prev + 1);
      audio.playYehey();
    }

    setTimeout(() => {
      nextQuestion();
    }, 1500);
  };

  const startQuiz = (mode: 'bible' | 'verse') => {
    let newQuestions: Question[];
    if (mode === 'verse') {
      newQuestions = getMemoryVerseQuestionsForWave(1, usedQuestionIds);
    } else {
      newQuestions = getQuestionsForWave(1, usedQuestionIds);
    }

    if (!newQuestions || newQuestions.length === 0) {
      console.error("No questions generated for mode:", mode);
      return;
    }

    // Mark these questions as used FIRST
    const newUsedIds = new Set(usedQuestionIds);
    newQuestions.forEach(q => newUsedIds.add(q.id));
    setUsedQuestionIds(newUsedIds);

    // Set questions BEFORE enabling quiz mode
    setQuestions(newQuestions);
    setActiveMode(mode);
    setCurrentWave(1);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setTimeLeft(QUESTION_TIMER);
    setCorrectAnswers(0);
    setWaveCorrectAnswers(0);
    setShowResults(false);
    setShowWaveComplete(false);

    // Enable quiz mode LAST
    setQuizStarted(true);
    audio.playClick();
  };

  const startNextWave = () => {
    const nextWave = currentWave + 1;
    if (nextWave <= TOTAL_WAVES) {
      setCurrentWave(nextWave);

      let newQuestions: Question[];
      if (activeMode === 'verse') {
        newQuestions = getMemoryVerseQuestionsForWave(nextWave, usedQuestionIds);
      } else {
        newQuestions = getQuestionsForWave(nextWave, usedQuestionIds);
      }
      setQuestions(newQuestions);

      // Mark these questions as used
      const newUsedIds = new Set(usedQuestionIds);
      newQuestions.forEach(q => newUsedIds.add(q.id));
      setUsedQuestionIds(newUsedIds);

      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setTimeLeft(QUESTION_TIMER);
      setWaveCorrectAnswers(0);
      setShowWaveComplete(false);
      audio.playClick();
    } else {
      setShowResults(true);
    }
  };

  const handleWatering = () => {
    if (waterAmount >= 10) {
      setWaterAmount(prev => prev - 10);
      setGrowthProgress(prev => Math.min(prev + 5, 100));
      setPointsCollected(prev => prev + 2.5);
      audio.playYehey();
    }
  };

  const completeQuest = () => {
    const waterReward = 50 + (correctAnswers * 5);
    setWaterAmount(prev => prev + waterReward);
    setPointsCollected(prev => prev + (correctAnswers * 1.5));

    setTimeout(() => {
      setActiveMode(null);
      setQuizStarted(false);
      setShowResults(false);
    }, 2000);
  };

  const handleBack = () => {
    if (quizStarted) {
      setQuizStarted(false);
      setShowResults(false);
      setShowWaveComplete(false);
    } else {
      setActiveMode(null);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const currentStage = getTreeStage(growthProgress);
  const currentDifficulty = getWaveDifficulty(currentWave);

  // Timer circle calculations
  const timerProgress = (timeLeft / QUESTION_TIMER) * 100;
  const timerCircumference = 2 * Math.PI * 40;
  const timerOffset = timerCircumference - (timerProgress / 100) * timerCircumference;
  const isTimeLow = timeLeft <= 5;

  const getWaveColor = (wave: number) => {
    if (wave <= 2) return 'bg-green-100 text-green-600 border-green-400';
    if (wave <= 4) return 'bg-yellow-100 text-yellow-600 border-yellow-400';
    return 'bg-red-100 text-red-600 border-red-400';
  };

  const [showFloatingText, setShowFloatingText] = useState(false);
  const [floatingText, setFloatingText] = useState('');
  const [particles, setParticles] = useState<{ id: number, x: number, y: number }[]>([]);

  // Main Garden View - Faith Land
  if (!activeMode) {
    const handleWaterClick = () => {
      handleWatering();
      setFloatingText('+10 XP');
      setShowFloatingText(true);
      setTimeout(() => setShowFloatingText(false), 1000);

      // Add particles
      const newParticles = Array.from({ length: 5 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 200 - 100,
        y: Math.random() * -100 - 50
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 1000);
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-300 via-sky-200 to-sky-100 flex flex-col relative overflow-hidden">
        {/* Floating Clouds Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-10 left-10 w-24 h-12 bg-white/70 rounded-full"
            animate={{ x: [0, 20, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <motion.div
            className="absolute top-20 right-20 w-32 h-16 bg-white/60 rounded-full"
            animate={{ x: [0, -15, 0] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute top-40 left-1/3 w-20 h-10 bg-white/50 rounded-full"
            animate={{ x: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center px-4 py-4 pt-8 relative z-10">
          <motion.button
            onClick={() => audio.playClick()}
            className="flex items-center gap-2 bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg"
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="text-white w-5 h-5" />
            <span className="text-white font-bold">Back</span>
          </motion.button>

          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 px-4 py-2 rounded-full shadow-lg border-2 border-white">
            <span className="text-white font-black text-sm">Level 5</span>
          </div>

          <motion.button
            onClick={() => audio.playClick()}
            className="bg-white/30 backdrop-blur-sm p-2 rounded-full shadow-lg"
            whileTap={{ scale: 0.95 }}
          >
            <Settings className="text-white w-5 h-5" />
          </motion.button>
        </div>

        {/* Main Stage - Floating Island */}
        <div className="flex-1 flex flex-col items-center justify-center relative px-4">
          {/* Growth Progress Badge */}
          <motion.div
            className="absolute top-0 bg-gradient-to-r from-yellow-400 to-orange-400 px-6 py-2 rounded-full shadow-lg border-3 border-white z-20"
            initial={{ scale: 0, y: -50 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <span className="text-white font-black text-lg">🌱 Growth: {growthProgress}%</span>
          </motion.div>

          {/* Floating Island Base */}
          <div className="relative flex flex-col items-center">
            {/* Floating Particles */}
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute text-2xl"
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: particle.x, y: particle.y, opacity: 0 }}
                transition={{ duration: 0.8 }}
              >
                💧
              </motion.div>
            ))}

            {/* Floating XP Text */}
            {showFloatingText && (
              <motion.div
                className="absolute -top-20 left-1/2 transform -translate-x-1/2 z-30"
                initial={{ scale: 0, y: 0 }}
                animate={{ scale: 1.5, y: -50 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="text-3xl font-black text-yellow-400 drop-shadow-lg">{floatingText}</span>
              </motion.div>
            )}

            {/* Island Shape */}
            <div className="relative">
              {/* Island Top (Green Grass) */}
              <motion.div
                className="w-72 h-16 bg-gradient-to-b from-green-400 to-green-500 rounded-[50%] shadow-2xl relative"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {/* Soil layer */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-64 h-10 bg-gradient-to-b from-amber-700 to-amber-800 rounded-[50%]" />
              </motion.div>

              {/* The Tree */}
              <motion.div
                className="absolute -top-40 left-1/2 transform -translate-x-1/2 text-[8rem] drop-shadow-2xl"
                animate={{ scale: [1, 1.03, 1], rotate: [0, 1, -1, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                {currentStage.emoji}
              </motion.div>

              {/* Sparkle Effects */}
              <motion.div
                className="absolute -top-20 -right-8 text-yellow-400"
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-6 h-6" />
              </motion.div>
              <motion.div
                className="absolute -top-28 -left-4 text-yellow-400"
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              >
                <Sparkles className="w-5 h-5" />
              </motion.div>
            </div>

            {/* Points Display */}
            <motion.div
              className="mt-12 bg-white/40 backdrop-blur-sm px-8 py-3 rounded-2xl shadow-lg border-2 border-white/50"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-white font-bold text-xl drop-shadow-md">
                ⭐ {pointsCollected.toFixed(0)} / {targetPoints.toFixed(0)}
              </span>
            </motion.div>
          </div>

          {/* Mission Buttons (Left & Right) */}
          <div className="absolute top-1/3 left-0 right-0 px-6 flex justify-between pointer-events-none">
            {/* Bible Story Button */}
            <motion.button
              onClick={() => startQuiz('bible')}
              className="pointer-events-auto flex flex-col items-center"
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-xl border-4 border-white flex items-center justify-center">
                <BookOpen className="text-white w-8 h-8" />
              </div>
              <span className="mt-2 bg-white/90 px-3 py-1 rounded-full text-sm font-bold text-blue-800 shadow">Bible Story</span>
            </motion.button>

            {/* Memory Verse Button */}
            <motion.button
              onClick={() => startQuiz('verse')}
              className="pointer-events-auto flex flex-col items-center"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full shadow-xl border-4 border-white flex items-center justify-center">
                <ScrollText className="text-white w-8 h-8" />
              </div>
              <span className="mt-2 bg-white/90 px-3 py-1 rounded-full text-sm font-bold text-purple-800 shadow">Memory Verse</span>
            </motion.button>
          </div>
        </div>

        {/* Bottom Action Zone */}
        <div className="bg-white/20 backdrop-blur-md rounded-t-3xl px-6 py-4 pb-8 relative z-20">
          {/* Growth Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-white font-bold text-sm">Growth</span>
              <span className="text-white font-bold text-sm">{growthProgress.toFixed(0)}%</span>
            </div>
            <div className="h-4 bg-gray-300/50 rounded-full overflow-hidden shadow-inner border-2 border-white/30">
              <motion.div
                className="h-full bg-gradient-to-r from-green-400 via-green-500 to-emerald-400"
                style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.3) 10px, rgba(255,255,255,0.3) 20px)'
                }}
                animate={{ backgroundPosition: ['0% 0%', '100% 0%'] }}
                transition={{ duration: 2, repeat: Infinity }}
                initial={{ width: `${(growthProgress / 100) * 100}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-end relative">
            {/* Left Side - Water Amount */}
            <div className="flex flex-col items-center">
              <div className="bg-gradient-to-br from-green-600 to-green-400 px-6 py-2 rounded-full shadow-lg border-3 border-white mb-2">
                <span className="text-white font-black text-sm">💧 {waterAmount}ml</span>
              </div>
            </div>

            {/* Giant Water Button */}
            <motion.button
              onClick={handleWaterClick}
              className="relative w-24 h-24 -mt-4"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.85 }}
            >
              {/* Button Shadow/Depth */}
              <div className="absolute inset-0 bg-orange-600 rounded-full bottom-0 shadow-2xl border-4 border-orange-800" />
              {/* Main Button */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white/50">
                <Droplets className="text-white w-12 h-12 drop-shadow-md" />
              </div>
              {/* Shine Effect */}
              <div className="absolute top-2 left-4 w-8 h-4 bg-white/40 rounded-full transform -rotate-12" />
            </motion.button>

            {/* Right Side - Spacer for balance */}
            <div className="w-20" />
          </div>
        </div>
      </div>
    );
  }

  // Quiz View
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-sky-100 to-green-100 p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="max-w-2xl mx-auto"
      >
        <button
          onClick={handleBack}
          className="mb-4 text-gray-600 hover:text-gray-800 font-bold flex items-center gap-2 bg-white/50 px-4 py-2 rounded-full"
        >
          <ChevronLeft className="w-5 h-5" /> Back
        </button>

        {!quizStarted ? (
          // Quiz Intro
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-white">
            <div className="text-center space-y-6">
              <div className={`inline-flex p-6 rounded-3xl ${activeMode === 'bible' ? 'bg-blue-500' : 'bg-purple-500'} text-white shadow-lg`}>
                {activeMode === 'bible' ? <BookOpen className="w-12 h-12" /> : <ScrollText className="w-12 h-12" />}
              </div>

              <div>
                <h2 className="text-3xl font-black text-gray-800">
                  {activeMode === 'bible' ? 'Bible Story' : 'Memory Verse'}
                </h2>
                <p className="text-gray-600">5 Waves Challenge!</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 space-y-3 text-left">
                <div className="flex items-center gap-3">
                  <Waves className="w-5 h-5 text-pink-500" />
                  <span className="text-gray-700 font-bold">5 Waves (50 Questions)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-400"></span>
                  <span className="text-gray-600 text-sm">Waves 1-2: Easy</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                  <span className="text-gray-600 text-sm">Waves 3-4: Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400"></span>
                  <span className="text-gray-600 text-sm">Wave 5: Hard</span>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Clock className="w-5 h-5 text-pink-500" />
                  <span className="text-gray-700 font-bold">30 seconds per question</span>
                </div>
              </div>

              <motion.button
                onClick={() => setQuizStarted(true)}
                className="w-full py-4 px-8 rounded-2xl font-black text-white text-lg bg-gradient-to-r from-pink-400 to-purple-500 shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Start Challenge
              </motion.button>
            </div>
          </div>
        ) : showResults ? (
          // Final Results
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-white">
            <div className="text-center space-y-6">
              <div className="inline-flex p-6 rounded-3xl bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg">
                <Award className="w-12 h-12" />
              </div>

              <h2 className="text-3xl font-black text-gray-800">All Waves Complete!</h2>

              <div className="text-5xl font-black text-pink-500">
                {correctAnswers}/{TOTAL_WAVES * QUESTIONS_PER_WAVE}
              </div>

              <div className="bg-green-50 rounded-2xl p-4">
                <p className="text-green-600 font-bold text-xl">
                  +{50 + (correctAnswers * 5)}ml Water Earned!
                </p>
              </div>

              <motion.button
                onClick={completeQuest}
                className="w-full py-4 px-8 rounded-2xl font-black text-white text-lg bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Collect Reward
              </motion.button>
            </div>
          </div>
        ) : showWaveComplete ? (
          // Wave Complete
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-white">
            <div className="text-center space-y-6">
              <div className={`inline-flex p-6 rounded-3xl ${getWaveColor(currentWave)} shadow-lg`}>
                <Waves className="w-12 h-12" />
              </div>

              <h2 className="text-3xl font-black text-gray-800">Wave {currentWave} Complete!</h2>

              <div className="text-5xl font-black text-pink-500">
                {waveCorrectAnswers}/{QUESTIONS_PER_WAVE}
              </div>

              <motion.button
                onClick={startNextWave}
                className="w-full py-4 px-8 rounded-2xl font-black text-white text-lg bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {currentWave < TOTAL_WAVES ? 'Next Wave' : 'See Results'}
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        ) : !currentQuestion ? (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-white text-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
              <div className="h-4 bg-gray-200 rounded w-48"></div>
              <p className="text-gray-500 font-bold">Preparing Quest...</p>
            </div>
          </div>
        ) : (
          // Quiz Question
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-white">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`px-4 py-2 rounded-full font-bold text-sm ${getWaveColor(currentWave)}`}>
                  WAVE {currentWave}/{TOTAL_WAVES}
                </span>
              </div>

              {/* Timer */}
              <div className="relative w-16 h-16">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={isTimeLow ? '#ef4444' : '#ec4899'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={timerCircumference}
                    strokeDashoffset={timerOffset}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xl font-black ${isTimeLow ? 'text-red-500' : 'text-gray-800'}`}>
                    {timeLeft}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                <span>Question {currentQuestionIndex + 1}/{QUESTIONS_PER_WAVE}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-pink-400 to-purple-400"
                  animate={{ width: `${((currentQuestionIndex + 1) / QUESTIONS_PER_WAVE) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <h3 className="text-2xl font-black text-gray-800 text-center mb-6">
              {currentQuestion.question}
            </h3>

            {/* Multiple Choice Options */}
            <div className="space-y-3">
              {currentQuestion.options?.map((option, index) => {
                const isCorrect = index === currentQuestion.correctAnswer;
                const isSelected = selectedAnswer === index;
                const showCorrectness = isAnswered;

                let buttonClass = "w-full p-4 rounded-2xl border-2 font-bold text-left transition-all flex items-center gap-4 ";

                if (showCorrectness) {
                  if (isCorrect) {
                    buttonClass += "bg-green-100 border-green-500 text-green-800";
                  } else if (isSelected && !isCorrect) {
                    buttonClass += "bg-red-100 border-red-500 text-red-800";
                  } else {
                    buttonClass += "bg-gray-50 border-gray-200 text-gray-400";
                  }
                } else {
                  buttonClass += "bg-white border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700";
                }

                return (
                  <motion.button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={isAnswered}
                    className={buttonClass}
                    whileHover={!isAnswered ? { scale: 1.02 } : {}}
                    whileTap={!isAnswered ? { scale: 0.98 } : {}}
                  >
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${showCorrectness
                        ? isCorrect ? "bg-green-500 text-white" : isSelected ? "bg-red-500 text-white" : "bg-gray-200 text-gray-400"
                        : "bg-gray-100 text-gray-600"
                      }`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {showCorrectness && isCorrect && <span className="text-2xl">✓</span>}
                    {showCorrectness && isSelected && !isCorrect && <span className="text-2xl">✗</span>}
                  </motion.button>
                );
              })}
            </div>

            {isAnswered && selectedAnswer === null && (
              <motion.div className="mt-4 text-center text-red-500 font-bold flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Time's up!
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SideQuestPage;