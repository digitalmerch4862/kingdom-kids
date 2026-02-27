import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { UserSession } from '../types';
import { audio } from '../services/audio.service';
import { db } from '../services/db.service';
import { MinistryService } from '../services/ministry.service';
import { BookOpen, ScrollText, ChevronLeft, Waves, Award, Clock, AlertCircle, ChevronRight, Settings } from 'lucide-react';

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
        id: parseInt(day) * 10000 + questions.length, // Use 10000+ to avoid conflict with memory verse IDs (1000-4000)
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
const MEMORY_VERSE_TIMER = 5; // 5 seconds to memorize
const SIDEQUEST_BACKGROUND_URL = '/GamifyBG.png';

// Memory Verse with full text and hidden words for new mechanics
interface MemoryVerse {
  id: number;
  reference: string;
  fullText: string;
  hiddenWords: string[]; // 3 words to hide
}

const memoryVerses: MemoryVerse[] = [
  { id: 1, reference: "Proverbs 11:1", fullText: "The Lord detests dishonest scales, but accurate weights are his delight.", hiddenWords: ["detests", "dishonest", "accurate"] },
  { id: 2, reference: "Psalm 23:1", fullText: "The Lord is my shepherd, I lack nothing.", hiddenWords: ["shepherd", "lack", "nothing"] },
  { id: 3, reference: "John 3:16", fullText: "For God so loved the world that he gave his one and only Son.", hiddenWords: ["loved", "world", "only"] },
  { id: 4, reference: "Philippians 4:13", fullText: "I can do all things through Christ who strengthens me.", hiddenWords: ["through", "Christ", "strengthens"] },
  { id: 5, reference: "Romans 8:28", fullText: "And we know that in all things God works for the good of those who love him.", hiddenWords: ["know", "works", "love"] },
  { id: 6, reference: "Psalm 100:2", fullText: "Serve the Lord with gladness and come before his presence with singing.", hiddenWords: ["gladness", "singing", "presence"] },
  { id: 7, reference: "1 John 4:8", fullText: "Whoever does not love does not know God, because God is love.", hiddenWords: ["love", "God", "love"] },
  { id: 8, reference: "Matthew 6:34", fullText: "Therefore do not worry about tomorrow, for tomorrow will worry about itself.", hiddenWords: ["worry", "tomorrow", "tomorrow"] },
  { id: 9, reference: "Psalm 27:1", fullText: "The Lord is my light and my salvation, whom shall I fear?", hiddenWords: ["light", "salvation", "fear"] },
  { id: 10, reference: "Isaiah 40:31", fullText: "But they who wait for the Lord shall renew their strength.", hiddenWords: ["wait", "renew", "strength"] },
  { id: 11, reference: "Proverbs 3:5", fullText: "Trust in the Lord with all your heart and lean not on your own understanding.", hiddenWords: ["Trust", "heart", "understanding"] },
  { id: 12, reference: "Joshua 1:9", fullText: "Be strong and courageous. Do not be afraid; do not be discouraged.", hiddenWords: ["strong", "courageous", "afraid"] },
  { id: 13, reference: "Deuteronomy 31:6", fullText: "Be strong and courageous. Do not be afraid or terrified because of them.", hiddenWords: ["strong", "courageous", "terrified"] },
  { id: 14, reference: "Psalm 119:105", fullText: "Your word is a lamp to my feet and a light for my path.", hiddenWords: ["lamp", "light", "path"] },
  { id: 15, reference: "Ephesians 4:32", fullText: "Be kind and compassionate to one another, forgiving each other.", hiddenWords: ["kind", "compassionate", "forgiving"] },
];

// Get next memory verse question - 3 choices, all must be correct
const getMemoryVerseQuestion = (usedVerseIds: Set<number>): { verse: MemoryVerse; question: Question } | null => {
  const availableVerses = memoryVerses.filter(v => !usedVerseIds.has(v.id));

  // If all verses used, reset
  const versesToUse = availableVerses.length > 0 ? availableVerses : memoryVerses;
  const verse = versesToUse[Math.floor(Math.random() * versesToUse.length)];

  const correctWords = verse.hiddenWords;

  // Just use the 3 correct words as options - shuffle them
  const shuffledOptions = [...correctWords].sort(() => Math.random() - 0.5);

  // Question shows all 3 blanks
  const questionText = `Piliin ang 3 nawawalang salita sa "${verse.reference}":\n\n"${verse.fullText}"`;

  const question: Question = {
    id: 10000 + verse.id,
    question: questionText,
    options: shuffledOptions,
    correctAnswer: 0, // Will be handled specially - all 3 must be selected
    answer: correctWords.join(','), // Store all correct words
    difficulty: 'EASY'
  };

  return { verse, question };
};

const getVerseDifficulty = (wave: number): 'EASY' | 'MEDIUM' | 'HARD' | 'VERY HARD' => {
  if (wave === 1) return 'EASY';
  if (wave === 2) return 'MEDIUM';
  if (wave === 3) return 'HARD';
  return 'VERY HARD';
};

const getVerseDifficultyLevel = (wave: number): 'EASY' | 'MEDIUM' | 'HARD' | 'VERY HARD' => {
  return getVerseDifficulty(wave);
};

// Get memory verse questions - cycles through ALL verses repeatedly for memorization
const getMemoryVerseQuestions = (shownIds: Set<number>): { questions: Question[]; cycleComplete: boolean } => {
  // Get unused questions first
  let availableQuestions = memoryVerseQuestions.filter(q => !shownIds.has(q.id));

  // If we've shown all questions, reset the cycle
  const cycleComplete = availableQuestions.length === 0;
  if (cycleComplete) {
    availableQuestions = [...memoryVerseQuestions];
  }

  // Shuffle and return up to QUESTIONS_PER_WAVE
  const shuffled = availableQuestions.sort(() => Math.random() - 0.5);
  const questions = shuffled.slice(0, QUESTIONS_PER_WAVE);

  return { questions, cycleComplete };
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

// Tree stages - 5 stages based on 1000ml increments
const treeStages = [
  { image: '/stage1.png', name: 'Seedling', sizeClass: 'w-32 sm:w-36' },
  { image: '/stage2.png', name: 'Sprout', sizeClass: 'w-40 sm:w-44' },
  { image: '/stage3.png', name: 'Young Plant', sizeClass: 'w-48 sm:w-52' },
  { image: '/stage4.png', name: 'Growing Tree', sizeClass: 'w-56 sm:w-64' },
  { image: '/stage5.png', name: 'Mature Tree', sizeClass: 'w-64 sm:w-72' },
];

const SideQuestPage: React.FC<SideQuestPageProps> = ({ user }) => {
  const navigate = useNavigate();

  // Water and Tree State
  const [waterAmount, setWaterAmount] = useState(0); // Current water in jar
  const [totalWaterEarned, setTotalWaterEarned] = useState(0); // Total ml earned for leaderboard
  const [totalWaterPoured, setTotalWaterPoured] = useState(0); // Total ml poured on tree
  const [treeStage, setTreeStage] = useState(1); // Tree growth stage (1-5)

  // Quiz state

  // Quiz state
  const [currentWave, setCurrentWave] = useState(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Set<number>>(new Set()); // For memory verse multi-select
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
  const [memoryVerseShownIds, setMemoryVerseShownIds] = useState<Set<number>>(new Set()); // Track shown memory verses in current cycle
  const [currentMemoryVerse, setCurrentMemoryVerse] = useState<MemoryVerse | null>(null); // Current verse for memorize phase
  const [memoryVersePhase, setMemoryVersePhase] = useState<1 | 2>(1); // 1 = memorize, 2 = answer
  const [usedVerseIds, setUsedVerseIds] = useState<Set<number>>(new Set()); // Track which verses have been used

  const studentId = user.studentId || 'guest';
  const dailyQuestionsKey = `daily_questions_${studentId}_${new Date().toDateString()}`;

  useEffect(() => {
    async function loadProgress() {
      if (!studentId || studentId === 'guest') return;

      try {
        const profile = await db.getProfile(studentId);
        if (profile) {
          setWaterAmount(profile.water_balance || 0);
          setTotalWaterEarned(profile.total_xp || 0);
          setTotalWaterPoured(profile.total_water_poured || 0);
          setTreeStage(profile.current_plant_stage || 1);
        }

        // Load today's used question IDs (still using localStorage for temporary daily state is fine, 
        // but let's at least sync the main stats)
        const dailyUsed = localStorage.getItem(dailyQuestionsKey);
        if (dailyUsed) {
          const usedIds = JSON.parse(dailyUsed);
          setUsedQuestionIds(new Set(usedIds));
        }
      } catch (e) {
        console.error("Failed to load saved progress from Supabase", e);
      }
    }
    loadProgress();
  }, [studentId, dailyQuestionsKey]);

  // Sync state to Supabase when it changes
  useEffect(() => {
    async function syncProgress() {
      if (!studentId || studentId === 'guest') return;
      try {
        await db.updateProfile(studentId, {
          water_balance: waterAmount,
          total_xp: totalWaterEarned,
          total_water_poured: totalWaterPoured,
          current_plant_stage: treeStage
        });
      } catch (e) {
        console.error("Failed to sync progress to Supabase", e);
      }
    }
    syncProgress();
  }, [waterAmount, totalWaterEarned, totalWaterPoured, treeStage, studentId]);

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
  }, [quizStarted, showResults, showWaveComplete, isAnswered, currentQuestionIndex, memoryVersePhase]);

  const handleTimeUp = () => {
    // If in Memory Verse Phase 1 (memorize), transition to Phase 2 (answer)
    if (activeMode === 'verse' && memoryVersePhase === 1) {
      setMemoryVersePhase(2);
      setIsAnswered(false);
      setTimeLeft(QUESTION_TIMER);
      return;
    }

    setIsAnswered(true);
    setTimeout(() => {
      nextQuestion();
    }, 1500);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setSelectedAnswers(new Set());
      setIsAnswered(false);
      setTimeLeft(QUESTION_TIMER);
    } else {
      setShowWaveComplete(true);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (isAnswered) return;

    // Memory verse mode - multi-select
    if (activeMode === 'verse' && memoryVersePhase === 2) {
      const newSelected = new Set(selectedAnswers);
      if (newSelected.has(answerIndex)) {
        newSelected.delete(answerIndex);
      } else if (newSelected.size < 3) {
        newSelected.add(answerIndex);
      }
      setSelectedAnswers(newSelected);
      return;
    }

    // Normal mode - single select
    setSelectedAnswer(answerIndex);
    setIsAnswered(true);

    if (answerIndex === questions[currentQuestionIndex].correctAnswer) {
      setCorrectAnswers(prev => prev + 1);
      setWaveCorrectAnswers(prev => prev + 1);
      // Add 5ml to jar immediately for correct answer
      setWaterAmount(prev => prev + WATER_PER_CORRECT_ANSWER);
      setTotalWaterEarned(prev => prev + WATER_PER_CORRECT_ANSWER);
      audio.playYehey();
    }

    setTimeout(() => {
      nextQuestion();
    }, 1500);
  };

  const submitMemoryVerseAnswers = () => {
    if (selectedAnswers.size !== 3) return;

    const selectedWords = Array.from(selectedAnswers).map(i => currentQuestion.options?.[i] || '');
    const correctWords = (currentQuestion.answer || '').split(',');

    // Check if all 3 selected words are correct
    const allCorrect = selectedWords.every(word => correctWords.includes(word)) &&
      selectedWords.length === correctWords.length;

    setIsAnswered(true);

    if (allCorrect) {
      setCorrectAnswers(prev => prev + 1);
      setWaveCorrectAnswers(prev => prev + 1);
      setWaterAmount(prev => prev + WATER_PER_CORRECT_ANSWER);
      setTotalWaterEarned(prev => prev + WATER_PER_CORRECT_ANSWER);
      audio.playYehey();
    }

    setTimeout(() => {
      nextQuestion();
    }, 2000);
  };

  const startQuiz = (mode: 'bible' | 'verse') => {
    if (mode === 'verse') {
      // Memory Verse: New mechanics - Phase 1 (memorize) then Phase 2 (answer)
      const result = getMemoryVerseQuestion(usedVerseIds);

      if (!result) {
        console.error("No verse generated");
        return;
      }

      const { verse, question } = result;

      // Mark this verse as used
      const newUsedIds = new Set(usedVerseIds);
      newUsedIds.add(verse.id);
      setUsedVerseIds(newUsedIds);

      // Reset if all verses used
      if (newUsedIds.size >= memoryVerses.length) {
        setUsedVerseIds(new Set());
      }

      setCurrentMemoryVerse(verse);
      setQuestions([question]);
      setMemoryVersePhase(1);
      setTimeLeft(MEMORY_VERSE_TIMER);
    } else {
      // Bible Story: Normal mode with tracking
      const newQuestions = getQuestionsForWave(1, usedQuestionIds);

      if (!newQuestions || newQuestions.length === 0) {
        console.error("No questions generated for mode:", mode);
        return;
      }

      // Mark these questions as used
      const newUsedIds = new Set(usedQuestionIds);
      newQuestions.forEach(q => newUsedIds.add(q.id));
      setUsedQuestionIds(newUsedIds);

      setQuestions(newQuestions);
      setMemoryVersePhase(2); // Bible story skips memorize phase
      setTimeLeft(QUESTION_TIMER);
    }

    setActiveMode(mode);
    setCurrentWave(1);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setSelectedAnswers(new Set()); // Reset multi-select for memory verse
    setIsAnswered(false);
    setCorrectAnswers(0);
    setWaveCorrectAnswers(0);
    setShowResults(false);
    setShowWaveComplete(false);

    // Enable quiz mode LAST
    setQuizStarted(true);
    audio.playClick();
  };

  const startNextWave = () => {
    if (activeMode === 'verse') {
      // Memory Verse: Get next verse for memorize phase
      const result = getMemoryVerseQuestion(usedVerseIds);

      if (!result) {
        setShowWaveComplete(true);
        return;
      }

      const { verse, question } = result;

      // Mark this verse as used
      const newUsedIds = new Set(usedVerseIds);
      newUsedIds.add(verse.id);
      setUsedVerseIds(newUsedIds);

      // Reset if all verses used
      if (newUsedIds.size >= memoryVerses.length) {
        setUsedVerseIds(new Set());
      }

      setCurrentMemoryVerse(verse);
      setQuestions([question]);
      setMemoryVersePhase(1);
      setCurrentWave(prev => prev + 1);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setSelectedAnswers(new Set()); // Reset multi-select
      setIsAnswered(false);
      setTimeLeft(MEMORY_VERSE_TIMER);
      setWaveCorrectAnswers(0);
      setShowWaveComplete(false);
      audio.playClick();
    } else {
      // Bible Story: Normal wave system
      const nextWave = currentWave + 1;
      if (nextWave <= TOTAL_WAVES) {
        setCurrentWave(nextWave);

        const newQuestions = getQuestionsForWave(nextWave, usedQuestionIds);
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
    }
  };

  const WATER_PER_CORRECT_ANSWER = 5; // 5ml per correct answer
  const WATER_PER_WATERING = 50; // 50ml per watering click
  const TREE_GROWTH_THRESHOLD = 1000; // 1000ml to grow tree to next stage

  const handleWatering = async () => {
    if (waterAmount >= WATER_PER_WATERING) {
      const newWaterAmount = waterAmount - WATER_PER_WATERING;
      const newTotalPoured = totalWaterPoured + WATER_PER_WATERING;

      setWaterAmount(newWaterAmount);
      setTotalWaterPoured(newTotalPoured);

      // Check if tree should grow
      const growthStage = Math.floor(newTotalPoured / TREE_GROWTH_THRESHOLD) + 1;
      if (growthStage > treeStage && growthStage <= 5) {
        setTreeStage(growthStage);
      }

      // Add points to leaderboard (total water earned, not poured)
      if (user.studentId && user.studentId !== 'guest') {
        try {
          await MinistryService.addPoints(
            user.studentId,
            'Side Quest',
            WATER_PER_WATERING,
            'system',
            `Watered tree with ${WATER_PER_WATERING}ml`
          );
        } catch (err) {
          console.error('Failed to add points to leaderboard:', err);
        }
      }

      audio.playYehey();
    }
  };

  const completeQuest = () => {
    // Add 5ml per correct answer to jar
    const waterReward = correctAnswers * WATER_PER_CORRECT_ANSWER;

    setWaterAmount(prev => prev + waterReward);
    setTotalWaterEarned(prev => prev + waterReward);

    // Add earned water to leaderboard
    if (user.studentId && user.studentId !== 'guest' && waterReward > 0) {
      MinistryService.addPoints(
        user.studentId,
        'Side Quest',
        waterReward,
        'system',
        `Earned ${waterReward}ml from quiz (${correctAnswers} correct answers)`
      ).catch(err => console.error('Failed to add points:', err));
    }

    setTimeout(() => {
      setActiveMode(null);
      setQuizStarted(false);
      setShowResults(false);
      setCorrectAnswers(0);
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
  const currentStage = treeStages[treeStage - 1] || treeStages[0];
  const currentDifficulty = getWaveDifficulty(currentWave);

  // Timer circle calculations
  const currentTimerMax = (activeMode === 'verse' && memoryVersePhase === 1) ? MEMORY_VERSE_TIMER : QUESTION_TIMER;
  const timerProgress = (timeLeft / currentTimerMax) * 100;
  const timerCircumference = 2 * Math.PI * 40;
  const timerOffset = timerCircumference - (timerProgress / 100) * timerCircumference;
  const isTimeLow = timeLeft <= 2;

  const getWaveColor = (wave: number) => {
    if (wave <= 2) return 'bg-green-100 text-green-600 border-green-400';
    if (wave <= 4) return 'bg-yellow-100 text-yellow-600 border-yellow-400';
    return 'bg-red-100 text-red-600 border-red-400';
  };

  const [showFloatingText, setShowFloatingText] = useState(false);
  const [floatingText, setFloatingText] = useState('');
  const [particles, setParticles] = useState<{ id: number, x: number, y: number }[]>([]);
  const [isPouring, setIsPouring] = useState(false);

  // Main Garden View - Faith Land
  if (!activeMode) {
    const handleWaterClick = async () => {
      if (waterAmount < WATER_PER_WATERING) {
        // Not enough water
        setFloatingText('Need more water!');
        setShowFloatingText(true);
        setTimeout(() => setShowFloatingText(false), 1000);
        return;
      }

      setIsPouring(true);
      setTimeout(() => setIsPouring(false), 700);

      await handleWatering();
      setFloatingText(`-${WATER_PER_WATERING}ml`);
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
      <div className="min-h-screen flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${SIDEQUEST_BACKGROUND_URL}), linear-gradient(to bottom, #bae6fd, #bbf7d0)` }}
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6">
          <motion.button
            onClick={() => { audio.playClick(); navigate('/dashboard'); }}
            className="bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg border border-white/50"
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
          >
            <ChevronLeft className="text-green-600 w-6 h-6" />
          </motion.button>

          <div className="mx-3 flex-1 flex justify-center">
            <div className="relative h-10 sm:h-12 w-full max-w-[14rem] sm:max-w-[16rem] overflow-hidden rounded-full border-[3px] border-[#6b3f1f] bg-[#8b5a2b]/95 shadow-[0_6px_0_#5a341a,0_8px_16px_rgba(0,0,0,0.3)]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#f9d15a] via-[#f4c430] to-[#e5ac1f] shadow-inner"
                style={{ width: '57%' }}
              />
              <div className="relative z-10 flex h-full items-center justify-center gap-3 px-4">
                <span className="text-yellow-200 text-lg sm:text-xl leading-none drop-shadow-lg filter">⭐</span>
                <span className="text-sm sm:text-base font-black tracking-wider text-white drop-shadow-md">34 / 60</span>
              </div>
            </div>
          </div>

          <motion.button
            onClick={() => audio.playClick()}
            className="bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg border border-white/50"
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05, rotate: 90 }}
            transition={{ rotate: { duration: 0.3 } }}
          >
            <Settings className="text-green-600 w-6 h-6" />
          </motion.button>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-between px-4 sm:px-6 py-4 sm:py-6">
          {/* Main scene with Tree and Watering Can */}
          <div className="relative w-full flex-1 flex flex-col items-center justify-center">

            {/* Floating Watering Can - Centered Above Tree */}
            <motion.button
              type="button"
              onClick={handleWaterClick}
              className="relative z-30 mb-2"
              animate={{
                y: [0, -6, 0],
                rotate: [0, -2, 2, 0]
              }}
              transition={{
                y: { repeat: Infinity, duration: 2.5, ease: "easeInOut" },
                rotate: { repeat: Infinity, duration: 4, ease: "easeInOut" }
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
            >
              {/* Water Badge */}
              <div className="absolute -top-1 right-0 z-40 bg-gradient-to-br from-yellow-400 to-orange-500 text-white text-xs sm:text-sm font-black px-2 py-0.5 rounded-full shadow-lg border-2 border-white">
                {waterAmount}ml
              </div>

              <motion.div
                className="relative"
                animate={isPouring ? { rotate: -25, x: -10 } : { rotate: 0, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <img
                  src="/jar.png"
                  alt="Watering Can"
                  className="block w-14 sm:w-20 h-auto drop-shadow-2xl"
                />
              </motion.div>

              {/* Water particles */}
              {particles.map((particle) => (
                <motion.div
                  key={particle.id}
                  className="absolute top-full left-1/2 text-xl sm:text-2xl"
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{ x: particle.x, y: particle.y, opacity: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  💧
                </motion.div>
              ))}

              {/* Floating text */}
              {showFloatingText && (
                <motion.div
                  className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 text-xl sm:text-2xl font-black drop-shadow-lg whitespace-nowrap"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: -20 }}
                  exit={{ opacity: 0 }}
                >
                  {floatingText}
                </motion.div>
              )}
            </motion.button>

            {/* Life Tree */}
            <div className="relative flex flex-col items-center mt-2">
              {/* Pouring animation overlay */}
              {isPouring && (
                <motion.div
                  className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <img
                    src="/pouring%20jar.png"
                    alt="Pouring"
                    className="w-20 sm:w-28 h-auto"
                  />
                </motion.div>
              )}

              <motion.img
                src={currentStage.image}
                alt={currentStage.name}
                className={`w-36 sm:${currentStage.sizeClass} max-w-[65vw] sm:max-w-[78vw] origin-bottom drop-shadow-2xl`}
                animate={{
                  scale: [1, 1.02, 1],
                  rotate: [0, 0.5, -0.5, 0]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 4,
                  ease: "easeInOut"
                }}
              />
            </div>
          </div>

          {/* Bottom Navigation - Circular Buttons */}
          <div className="w-full flex items-end justify-center gap-4 sm:gap-6 px-2">
            {/* Bible Story Button */}
            <motion.button
              onClick={() => startQuiz('bible')}
              className="relative group"
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
            >
              <img
                src="/bible%20story.png"
                alt="Bible Story"
                className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-lg"
              />
            </motion.button>

            {/* Memory Verse Button */}
            <motion.button
              onClick={() => startQuiz('verse')}
              className="relative group"
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
            >
              <img
                src="/memmory%20verse.png"
                alt="Memory Verse"
                className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-lg"
              />
            </motion.button>
          </div>
        </div>

      </div>
    );
  }

  // Quiz View
  return (
    <div className="min-h-screen relative p-2 sm:p-4 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${SIDEQUEST_BACKGROUND_URL}), linear-gradient(to bottom, #bae6fd, #bbf7d0)` }}
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="w-full max-w-none"
        >
          <button
            onClick={handleBack}
            className="mb-2 sm:mb-4 text-gray-600 hover:text-gray-800 font-bold flex items-center gap-1 sm:gap-2 bg-white/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm sm:text-base"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Back
          </button>

          {!quizStarted ? (
            // Quiz Intro
            <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 shadow-xl border-2 sm:border-4 border-white">
              <div className="text-center space-y-3 sm:space-y-6">
                <div className={`inline-flex p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${activeMode === 'bible' ? 'bg-blue-500' : 'bg-purple-500'} text-white shadow-lg`}>
                  {activeMode === 'bible' ? <BookOpen className="w-8 h-8 sm:w-12 sm:h-12" /> : <ScrollText className="w-8 h-8 sm:w-12 sm:h-12" />}
                </div>

                <div>
                  <h2 className="text-xl sm:text-3xl font-black text-gray-800">
                    {activeMode === 'bible' ? 'Bible Story' : 'Memory Verse'}
                  </h2>
                  <p className="text-gray-600 text-sm sm:text-base">
                    {activeMode === 'bible' ? 'Read first, then start the challenge.' : '5 Waves Challenge!'}
                  </p>
                </div>

                {activeMode === 'bible' ? (
                  <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-left space-y-2 sm:space-y-3">
                    <h3 className="text-base sm:text-lg font-black text-gray-800">Bible Story Preview</h3>
                    <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                      Jesus told stories to teach people about God&apos;s love.
                      In this challenge, read the story first, then answer the questions.
                      Click <span className="font-black">Start Challenge</span> when you are ready.
                    </p>
                    <div className="flex items-center gap-2 sm:gap-3 pt-2 border-t">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500" />
                      <span className="text-gray-700 font-bold text-sm sm:text-base">30 seconds per question</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-2 sm:space-y-3 text-left">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Waves className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500" />
                      <span className="text-gray-700 font-bold text-sm sm:text-base">5 Waves (50 Questions)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-400"></span>
                      <span className="text-gray-600 text-xs sm:text-sm">Waves 1-2: Easy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400"></span>
                      <span className="text-gray-600 text-xs sm:text-sm">Waves 3-4: Medium</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400"></span>
                      <span className="text-gray-600 text-xs sm:text-sm">Wave 5: Hard</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 pt-2 border-t">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500" />
                      <span className="text-gray-700 font-bold text-sm sm:text-base">30 seconds per question</span>
                    </div>
                  </div>
                )}

                <motion.button
                  onClick={() => setQuizStarted(true)}
                  className="w-full py-3 sm:py-4 px-6 sm:px-8 rounded-xl sm:rounded-2xl font-black text-white text-base sm:text-lg bg-gradient-to-r from-pink-400 to-purple-500 shadow-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Start Challenge
                </motion.button>
              </div>
            </div>
          ) : showResults ? (
            // Final Results
            <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 shadow-xl border-2 sm:border-4 border-white">
              <div className="text-center space-y-3 sm:space-y-6">
                <div className="inline-flex p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg">
                  <Award className="w-8 h-8 sm:w-12 sm:h-12" />
                </div>

                <h2 className="text-xl sm:text-3xl font-black text-gray-800">All Waves Complete!</h2>

                <div className="text-3xl sm:text-5xl font-black text-pink-500">
                  {correctAnswers}/{TOTAL_WAVES * QUESTIONS_PER_WAVE}
                </div>

                <div className="bg-green-50 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                  <p className="text-green-600 font-bold text-base sm:text-xl">
                    +{50 + (correctAnswers * 5)}ml Water Earned!
                  </p>
                </div>

                <motion.button
                  onClick={completeQuest}
                  className="w-full py-3 sm:py-4 px-6 sm:px-8 rounded-xl sm:rounded-2xl font-black text-white text-base sm:text-lg bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Collect Reward
                </motion.button>
              </div>
            </div>
          ) : showWaveComplete ? (
            // Wave Complete
            <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 shadow-xl border-2 sm:border-4 border-white">
              <div className="text-center space-y-3 sm:space-y-6">
                <div className={`inline-flex p-4 sm:p-6 rounded-2xl sm:rounded-3xl ${activeMode === 'verse' ? 'bg-purple-100 text-purple-600' : getWaveColor(currentWave)} shadow-lg`}>
                  {activeMode === 'verse' ? <BookOpen className="w-8 h-8 sm:w-12 sm:h-12" /> : <Waves className="w-8 h-8 sm:w-12 sm:h-12" />}
                </div>

                <h2 className="text-xl sm:text-3xl font-black text-gray-800">
                  {activeMode === 'verse' ? 'Practice Complete!' : `Wave ${currentWave} Complete!`}
                </h2>

                {activeMode === 'verse' && (
                  <p className="text-sm sm:text-base text-purple-600 font-medium">
                    Great job practicing! Keep memorizing these verses.
                  </p>
                )}

                <div className="text-3xl sm:text-5xl font-black text-pink-500">
                  {waveCorrectAnswers}/{QUESTIONS_PER_WAVE}
                </div>

                <motion.button
                  onClick={startNextWave}
                  className="w-full py-3 sm:py-4 px-6 sm:px-8 rounded-xl sm:rounded-2xl font-black text-white text-base sm:text-lg bg-gradient-to-r from-blue-400 to-indigo-500 shadow-lg flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {activeMode === 'verse' ? 'Continue Practicing' : (currentWave < TOTAL_WAVES ? 'Next Wave' : 'See Results')}
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
              </div>
            </div>
          ) : !currentQuestion ? (
            <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-8 shadow-xl border-2 sm:border-4 border-white text-center">
              <div className="animate-pulse flex flex-col items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded-full"></div>
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-32 sm:w-48"></div>
                <p className="text-gray-500 font-bold text-sm sm:text-base">Preparing Quest...</p>
              </div>
            </div>
          ) : (
            // Quiz Question
            <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 shadow-xl border-2 sm:border-4 border-white">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm ${activeMode === 'verse' ? 'bg-purple-100 text-purple-700' : getWaveColor(currentWave)}`}>
                    {activeMode === 'verse'
                      ? (memoryVersePhase === 1 ? '📖 MEMORIZE' : `SET ${currentWave}`)
                      : `WAVE ${currentWave}/${TOTAL_WAVES}`
                    }
                  </span>
                </div>

                {/* Timer */}
                <div className="relative w-12 h-12 sm:w-16 sm:h-16">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke={isTimeLow ? '#ef4444' : (activeMode === 'verse' && memoryVersePhase === 1 ? '#9333ea' : '#ec4899')}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={timerCircumference}
                      strokeDashoffset={timerOffset}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-base sm:text-xl font-black ${isTimeLow ? 'text-red-500' : 'text-gray-800'}`}>
                      {timeLeft}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4 sm:mb-6">
                <div className="flex justify-between text-xs font-bold text-gray-500 mb-1 sm:mb-2">
                  <span>Question {currentQuestionIndex + 1}/{QUESTIONS_PER_WAVE}</span>
                </div>
                <div className="h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-pink-400 to-purple-400"
                    animate={{ width: `${((currentQuestionIndex + 1) / QUESTIONS_PER_WAVE) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question */}
              <div className="relative mb-4 sm:mb-6 mx-auto w-full max-w-3xl">
                {activeMode === 'verse' && memoryVersePhase === 1 && currentMemoryVerse ? (
                  // Phase 1: Show full verse to memorize
                  <div
                    className="w-full min-h-[180px] sm:min-h-[220px] md:min-h-[250px] rounded-2xl sm:rounded-3xl shadow-inner p-4 sm:p-8 md:p-10 flex flex-col items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #e8d5f2 0%, #d4b8e8 50%, #c9a8dc 100%)',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    <p className="text-sm sm:text-base font-bold text-purple-700 mb-2">{currentMemoryVerse.reference}</p>
                    <h3 className="text-center text-lg sm:text-xl md:text-2xl font-black text-purple-900 leading-relaxed">
                      {currentMemoryVerse.fullText}
                    </h3>
                    <p className="mt-4 text-xs sm:text-sm text-purple-600 font-medium">Memorize this verse!</p>
                  </div>
                ) : (
                  // Phase 2: Show question
                  <div
                    className="w-full min-h-[120px] sm:min-h-[180px] md:min-h-[200px] rounded-2xl sm:rounded-3xl shadow-inner p-4 sm:p-8 md:p-12 flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #f5deb3 0%, #f4e4c1 50%, #f5deb3 100%)',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    <h3 className="text-center text-base sm:text-lg md:text-2xl font-black text-gray-800 leading-snug whitespace-pre-line">
                      {currentQuestion.question}
                    </h3>
                  </div>
                )}
              </div>

              {/* Multiple Choice Options - Hide during Phase 1 (memorize) */}
              {!(activeMode === 'verse' && memoryVersePhase === 1) && (
                <div className="space-y-2 sm:space-y-3">
                  {/* Memory Verse Mode - Multi-select */}
                  {activeMode === 'verse' && memoryVersePhase === 2 ? (
                    <>
                      <p className="text-center text-sm font-bold text-purple-600 mb-2">Pumili ng 3 tamang salita (napili: {selectedAnswers.size}/3)</p>
                      <div className="grid grid-cols-3 gap-2">
                        {currentQuestion.options?.map((option, index) => {
                          const isSelected = selectedAnswers.has(index);
                          const showCorrectness = isAnswered;
                          const correctWords = (currentQuestion.answer || '').split(',');
                          const isCorrect = correctWords.includes(option);

                          let buttonClass = "p-2 sm:p-3 rounded-xl border-2 font-bold text-center text-sm sm:text-base transition-all ";

                          if (showCorrectness) {
                            if (isCorrect) {
                              buttonClass += "bg-green-100 border-green-500 text-green-800";
                            } else if (isSelected) {
                              buttonClass += "bg-red-100 border-red-500 text-red-800";
                            } else {
                              buttonClass += "bg-gray-50 border-gray-200 text-gray-400";
                            }
                          } else {
                            buttonClass += isSelected
                              ? "bg-purple-200 border-purple-500 text-purple-800"
                              : "bg-white border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700";
                          }

                          return (
                            <motion.button
                              key={index}
                              onClick={() => handleAnswerSelect(index)}
                              disabled={isAnswered}
                              className={buttonClass}
                              whileHover={!isAnswered ? { scale: 1.05 } : {}}
                              whileTap={!isAnswered ? { scale: 0.95 } : {}}
                            >
                              {option}
                              {isSelected && !showCorrectness && <span className="ml-1">✓</span>}
                            </motion.button>
                          );
                        })}
                      </div>
                      {/* Submit button for memory verse */}
                      {selectedAnswers.size === 3 && !isAnswered && (
                        <motion.button
                          onClick={submitMemoryVerseAnswers}
                          className="w-full py-3 sm:py-4 rounded-xl font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-500"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Submit Answers
                        </motion.button>
                      )}
                      {/* Result message */}
                      {isAnswered && (
                        <div className={`text-center py-2 rounded-xl font-bold ${selectedAnswers.size === 3 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {correctAnswers > waveCorrectAnswers ? '🎉 Tamang sagot!' : '❌ Mali ang sagot'}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Normal Mode - Single select */
                    currentQuestion.options?.map((option, index) => {
                      const isCorrect = index === currentQuestion.correctAnswer;
                      const isSelected = selectedAnswer === index;
                      const showCorrectness = isAnswered;

                      let buttonClass = "w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 font-bold text-left transition-all flex items-center gap-2 sm:gap-4 ";

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
                          <span className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-xs sm:text-sm ${showCorrectness
                            ? isCorrect ? "bg-green-500 text-white" : isSelected ? "bg-red-500 text-white" : "bg-gray-200 text-gray-400"
                            : "bg-gray-100 text-gray-600"
                            }`}>
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1 text-sm sm:text-base">{option}</span>
                          {showCorrectness && isCorrect && <span className="text-xl sm:text-2xl">✓</span>}
                          {showCorrectness && isSelected && !isCorrect && <span className="text-xl sm:text-2xl">✗</span>}
                        </motion.button>
                      );
                    })
                  )}
                </div>
              )}

              {isAnswered && selectedAnswer === null && (
                <motion.div className="mt-3 sm:mt-4 text-center text-red-500 font-bold flex items-center justify-center gap-2 text-sm sm:text-base">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  Time's up!
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default SideQuestPage;
