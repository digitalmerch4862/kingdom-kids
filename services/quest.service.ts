
import { GoogleGenAI, Type } from "@google/genai";
import { db } from './db.service';
import { MinistryService } from './ministry.service';
import { safeJsonParse } from '../utils/storage';

export interface QuestStory {
  title: string;
  content: string;
  quiz: { q: string; options: string[]; a: string }[];
  topic: string;
}

// Fallback Bible stories for kids when AI fails
const FALLBACK_STORIES: QuestStory[] = [
  {
    title: "David and Goliath",
    content: "David was a young shepherd boy who loved God very much. One day, he heard a giant named Goliath shouting terrible things about God. Goliath was over nine feet tall! But David was not afraid. He knew God was with him. David picked up his sling and five smooth stones. He put a stone in his sling, swung it, and hit Goliath right between the eyes! The giant fell down! Everyone cheered for David. This teaches us that when we trust in God, He helps us overcome big challenges.",
    quiz: [
      { q: "What was David's job before he fought Goliath?", options: ["Shepherd", "King", "Soldier", "Farmer"], a: "Shepherd" },
      { q: "What weapon did David use?", options: ["Sword", "Sling", "Bow and arrow", "Spear"], a: "Sling" },
      { q: "Why was David not afraid of Goliath?", options: ["He was very strong", "He trusted God", "He had armor", "He practiced fighting"], a: "He trusted God" },
      { q: "How tall was Goliath?", options: ["Six feet", "Over nine feet", "Five feet", "Seven feet"], a: "Over nine feet" },
      { q: "How many stones did David pick up?", options: ["Three", "Five", "Ten", "One"], a: "Five" },
      { q: "What did David say he came in the name of?", options: ["King Saul", "His father", "The Lord Almighty", "Israel"], a: "The Lord Almighty" },
      { q: "Where did the stone hit Goliath?", options: ["His chest", "His leg", "Between the eyes", "His arm"], a: "Between the eyes" },
      { q: "What animals did David protect his sheep from?", options: ["Wolves", "Lions and bears", "Foxes", "Eagles"], a: "Lions and bears" },
      { q: "Who sent David to the battlefield?", options: ["King Saul", "His father", "His brothers", "God"], a: "His father" },
      { q: "Why did David take off the armor?", options: ["It was too big and heavy", "He didn't like it", "It was broken", "He forgot how to wear it"], a: "It was too big and heavy" },
      { q: "What did Goliath do when he saw David?", options: ["He ran away", "He laughed", "He cried", "He bowed"], a: "He laughed" },
      { q: "Who did David bring food to?", options: ["The army", "His brothers", "King Saul", "The giant"], a: "His brothers" }
    ],
    topic: "David Goliath"
  },
  {
    title: "Noah's Ark",
    content: "Noah was a good man who followed God while others did bad things. God told Noah to build a big boat called an ark because a flood was coming. Noah obeyed God and built the ark with his three sons. He brought his family and animals inside. For forty days, rain fell and covered everything. They floated safely in the ark for 150 days. When the water went down, Noah sent out a dove. It came back with an olive leaf! God promised never to flood the earth again and put a rainbow in the sky as a sign.",
    quiz: [
      { q: "What did God ask Noah to build?", options: ["A tower", "A house", "An ark", "A temple"], a: "An ark" },
      { q: "Why did Noah build the ark?", options: ["For a flood", "To travel", "To store food", "For fishing"], a: "For a flood" },
      { q: "How many of each unclean animal came to the ark?", options: ["One pair", "Two pairs", "Seven pairs", "Ten pairs"], a: "One pair" },
      { q: "How long did the rain last?", options: ["Seven days", "Forty days and nights", "One year", "One month"], a: "Forty days and nights" },
      { q: "What bird did Noah send out first?", options: ["Dove", "Raven", "Eagle", "Sparrow"], a: "Raven" },
      { q: "What did the dove bring back the second time?", options: ["A worm", "An olive leaf", "A twig", "Nothing"], a: "An olive leaf" },
      { q: "How many sons did Noah have?", options: ["Two", "Three", "Four", "One"], a: "Three" },
      { q: "What are the names of Noah's sons?", options: ["Shem, Ham, Japheth", "Cain, Abel, Seth", "Abraham, Isaac, Jacob", "Peter, James, John"], a: "Shem, Ham, Japheth" },
      { q: "What is the sign of God's promise?", options: ["Stars", "Rainbow", "Cloud", "Sun"], a: "Rainbow" },
      { q: "How long did they float on the water?", options: ["40 days", "150 days", "One week", "One month"], a: "150 days" },
      { q: "How many pairs of clean animals did Noah bring?", options: ["One pair", "Two pairs", "Seven pairs", "Ten pairs"], a: "Seven pairs" },
      { q: "What did people do while Noah built the ark?", options: ["They helped", "They laughed at him", "They prayed with him", "They built their own"], a: "They laughed at him" }
    ],
    topic: "Noah Ark"
  },
  {
    title: "Daniel in the Lions' Den",
    content: "Daniel was a wise and faithful man who served as an important official in the kingdom of Babylon. King Darius recognized Daniel's wisdom and planned to put him in charge of the whole kingdom. This made the other officials jealous and angry. They tried to find something wrong with Daniel's work, but they couldn't because he was trustworthy and honest. So they decided to attack Daniel's faith in God. The officials went to King Darius and tricked him into making a new law. They told the king to issue a decree that for thirty days, anyone who prayed to any god or human being except the king would be thrown into the lions' den. The king signed the law, not knowing it was a trap for Daniel. Daniel heard about the new law, but he continued to pray to God just as he had always done. Three times a day, he went to his upstairs room, opened his window toward Jerusalem, got down on his knees, and prayed to God, thanking Him. The jealous officials saw Daniel praying and went to tell the king. They reminded him that he had signed a law that couldn't be changed. King Darius was very upset, but he had to follow his own law. He ordered Daniel to be thrown into the lions' den. Before they sealed the entrance with a stone, the king said to Daniel, 'May your God, whom you serve continually, rescue you!' That night, the king couldn't sleep. He refused to eat and wouldn't listen to music. At dawn, he hurried to the lions' den and called out, 'Daniel, servant of the living God, has your God, whom you serve continually, been able to rescue you from the lions?' Daniel answered, 'May the king live forever! My God sent His angel, and he shut the mouths of the lions. They have not hurt me because I was found innocent in His sight.' King Darius was overjoyed! He ordered Daniel to be lifted out, and they found that not a single scratch was on him because he had trusted in God. Then the king threw the jealous officials and their families into the lions' den, and the lions overpowered them. King Darius wrote a new decree that everyone in his kingdom should respect and fear the God of Daniel.",
    quiz: [
      { q: "Why was Daniel thrown into the lions' den?", options: ["He stole", "He prayed to God", "He was mean", "He didn't work"], a: "He prayed to God" },
      { q: "What happened to the lions?", options: ["They ate Daniel", "They fell asleep", "Their mouths were shut", "They ran away"], a: "Their mouths were shut" },
      { q: "Who protected Daniel?", options: ["The king", "An angel", "His friends", "The soldiers"], a: "An angel" },
      { q: "How many times a day did Daniel pray?", options: ["Once", "Twice", "Three times", "Five times"], a: "Three times" },
      { q: "Which direction did Daniel face when he prayed?", options: ["North", "South", "East", "Jerusalem"], a: "Jerusalem" },
      { q: "Who was jealous of Daniel?", options: ["The king", "Other officials", "The lions", "His family"], a: "Other officials" },
      { q: "How long was the law supposed to last?", options: ["Seven days", "Thirty days", "One year", "Forever"], a: "Thirty days" },
      { q: "What did the king do when he couldn't sleep?", options: ["He ate food", "He listened to music", "He refused to eat", "He prayed"], a: "He refused to eat" },
      { q: "Was Daniel hurt by the lions?", options: ["Yes, badly", "No, not at all", "A little", "Only his clothes"], a: "No, not at all" },
      { q: "What did King Darius write after Daniel was saved?", options: ["A book", "A new decree", "A poem", "A song"], a: "A new decree" },
      { q: "What did the king say before sealing the den?", options: ["Goodbye", "May your God rescue you", "You deserve this", "Pray to me instead"], a: "May your God rescue you" },
      { q: "What did the king do to the jealous officials?", options: ["Promoted them", "Fired them", "Threw them into the lions' den", "Fined them"], a: "Threw them into the lions' den" }
    ],
    topic: "Daniel Lions"
  },
  {
    title: "Moses Parts the Red Sea",
    content: "The Israelites had been slaves in Egypt for hundreds of years, crying out to God for help. God chose Moses, a Hebrew who had been raised as an Egyptian prince, to lead His people to freedom. Moses and his brother Aaron went to Pharaoh and demanded, 'Let my people go!' But Pharaoh's heart was hard, and he refused. So God sent ten terrible plagues upon Egypt to show His power - turning the Nile to blood, sending frogs, gnats, flies, diseased livestock, boils, hail, locusts, darkness, and finally the death of every firstborn. After the tenth plague, Pharaoh finally agreed to let the Israelites go. About 600,000 Israelites left Egypt in a hurry, taking their flocks and herds with them. But then Pharaoh changed his mind! He gathered his army with 600 chariots and chased after the Israelites. The Israelites found themselves trapped between Pharaoh's army and the Red Sea. They were terrified and complained to Moses, saying it would have been better to stay as slaves in Egypt. Moses told them, 'Do not be afraid. Stand firm and you will see the deliverance the Lord will bring you today.' Then God told Moses to raise his staff and stretch out his hand over the sea. A strong east wind blew all night long, dividing the water and creating dry land with walls of water on both sides! The Israelites walked through the sea on dry ground, with the water like walls to their right and left. The Egyptians followed them into the sea, but God made their chariot wheels get stuck. When the Israelites had safely crossed, Moses stretched out his hand again, and the waters came rushing back together. The entire Egyptian army - all of Pharaoh's horses, chariots, and horsemen - was swallowed by the sea. Not one of them survived! When the Israelites saw this great power that the Lord displayed against the Egyptians, they feared the Lord and put their trust in Him and in Moses His servant. Miriam, Moses' sister, took a tambourine and led all the women in dancing and singing praises to God for their miraculous deliverance.",
    quiz: [
      { q: "Where were the Israelites slaves?", options: ["Egypt", "Israel", "Babylon", "Rome"], a: "Egypt" },
      { q: "What did Moses use to part the sea?", options: ["A sword", "His staff", "His hands", "A rock"], a: "His staff" },
      { q: "What happened to the Egyptian army?", options: ["They escaped", "They went home", "The waters covered them", "They stopped chasing"], a: "The waters covered them" },
      { q: "How many plagues did God send?", options: ["Seven", "Ten", "Twelve", "Three"], a: "Ten" },
      { q: "Who was Moses' brother?", options: ["Aaron", "Joseph", "Jacob", "Isaac"], a: "Aaron" },
      { q: "What did God use to divide the water?", options: ["A big stick", "A strong east wind", "His voice", "Earthquake"], a: "A strong east wind" },
      { q: "How many chariots did Pharaoh bring?", options: ["100", "300", "600", "1000"], a: "600" },
      { q: "Who led the women in dancing and singing?", options: ["Moses", "Aaron", "Miriam", "Pharaoh's daughter"], a: "Miriam" },
      { q: "What did Moses tell the people to do?", options: ["Run away", "Be afraid", "Stand firm", "Surrender"], a: "Stand firm" },
      { q: "What happened to the Egyptian chariot wheels?", options: ["They fell off", "They got stuck", "They broke", "Nothing"], a: "They got stuck" },
      { q: "What was the last plague?", options: ["Darkness", "Hail", "Death of firstborn", "Locusts"], a: "Death of firstborn" },
      { q: "What instrument did Miriam use?", options: ["Harp", "Trumpet", "Tambourine", "Flute"], a: "Tambourine" }
    ],
    topic: "Moses Red Sea"
  },
  {
    title: "Jonah and the Big Fish",
    content: "Jonah was a prophet of God who received a very important message. God told Jonah to go to the great city of Nineveh and preach against it because its wickedness had come up before Him. But Jonah didn't want to go to Nineveh! The people there were enemies of Israel, and Jonah wanted God to destroy them, not give them a chance to repent. So Jonah decided to run away from God. He went to the port of Joppa and bought a ticket for a ship sailing to Tarshish, which was in the opposite direction of Nineveh. Jonah thought he could hide from God by sailing far away. But God saw exactly where Jonah was! The Lord sent a great wind on the sea that caused a violent storm. The waves were so high that the ship was in danger of breaking apart. The sailors were terrified and prayed to their gods, throwing cargo overboard to lighten the ship. Meanwhile, Jonah was down in the hold of the ship, fast asleep! The captain went and woke him up, saying, 'How can you sleep? Get up and call on your god! Maybe he will take notice of us so that we will not perish.' The sailors cast lots to find out who was responsible for the storm, and the lot fell on Jonah. They asked him who he was and what he had done. Jonah told them, 'I am a Hebrew and I worship the Lord, the God of heaven, who made the sea and the dry land. I am running away from the Lord.' The sailors were even more afraid when they heard this. Jonah told them to throw him into the sea to calm the storm, but they didn't want to. They tried to row back to land, but the storm grew worse. Finally, they cried out to the Lord, 'Please, Lord, do not let us die for taking this man's life. Do not hold us accountable for killing an innocent man.' Then they took Jonah and threw him overboard. Immediately the storm stopped and the sea became calm. But God wasn't finished with Jonah! The Lord provided a huge fish to swallow Jonah, and Jonah was inside the fish for three days and three nights. From inside the fish, Jonah prayed to God. He thanked God for saving him and promised to do what God asked. On the third day, God commanded the fish, and it vomited Jonah onto dry land. Then God spoke to Jonah again: 'Go to the great city of Nineveh and proclaim to it the message I give you.' This time Jonah obeyed! He went to Nineveh and preached that the city would be overthrown in forty days. The people of Nineveh believed God! They declared a fast, put on sackcloth, and turned from their evil ways. Even the king joined in! When God saw what they did and how they turned from their evil ways, He had compassion and did not bring destruction on them. But Jonah was angry! He had wanted God to destroy Nineveh. He went outside the city and sat under a shelter, waiting to see what would happen. God caused a plant to grow up and give Jonah shade, which made Jonah happy. But the next day God sent a worm to eat the plant, and it withered. Then God sent a scorching east wind and hot sun so that Jonah grew faint. God asked Jonah, 'Do you have a right to be angry about the plant?' Jonah said, 'I do. I am angry enough to die.' But the Lord said, 'You have been concerned about this plant, though you did not tend it or make it grow. It sprang up overnight and died overnight. And should I not have concern for the great city of Nineveh, in which there are more than a hundred and twenty thousand people who cannot tell their right hand from their left - and also many animals?' God taught Jonah that He loves all people, even those we might consider our enemies.",
    quiz: [
      { q: "Where was Jonah supposed to go?", options: ["Jerusalem", "Nineveh", "Egypt", "Babylon"], a: "Nineveh" },
      { q: "How long was Jonah inside the fish?", options: ["One day", "Two days", "Three days and nights", "Seven days"], a: "Three days and nights" },
      { q: "What did Jonah do inside the fish?", options: ["Slept", "Prayed", "Cried", "Ate"], a: "Prayed" },
      { q: "Where did Jonah try to run away to?", options: ["Nineveh", "Jerusalem", "Tarshish", "Babylon"], a: "Tarshish" },
      { q: "What did God send to stop the ship?", options: ["Pirates", "A great storm", "Whales", "Ice"], a: "A great storm" },
      { q: "Where was Jonah when the storm came?", options: ["On deck", "Praying", "Asleep in the hold", "Rowing"], a: "Asleep in the hold" },
      { q: "What did Jonah tell the sailors to do?", options: ["Pray harder", "Row faster", "Throw him overboard", "Turn back"], a: "Throw him overboard" },
      { q: "What swallowed Jonah?", options: ["A whale", "A big fish", "A shark", "A boat"], a: "A big fish" },
      { q: "What did the fish do to Jonah?", options: ["Ate him", "Vomited him onto dry land", "Carried him home", "Dropped him in the sea"], a: "Vomited him onto dry land" },
      { q: "How many days did Nineveh have before destruction?", options: ["Seven", "Ten", "Forty", "One hundred"], a: "Forty" },
      { q: "What did the people of Nineveh wear?", options: ["Fine clothes", "Sackcloth", "Armor", "Nothing"], a: "Sackcloth" },
      { q: "Why was Jonah angry at the end?", options: ["He was hungry", "God didn't destroy Nineveh", "He lost his shade", "The fish bit him"], a: "God didn't destroy Nineveh" }
    ],
    topic: "Jonah Fish"
  }
];

// Get a random fallback story
function getFallbackStory(history: string[] = []): QuestStory {
  // Filter out stories that have already been shown
  const availableStories = FALLBACK_STORIES.filter(story => !history.includes(story.topic));

  // If all stories have been shown, reset and pick from all
  const storiesToUse = availableStories.length > 0 ? availableStories : FALLBACK_STORIES;

  const randomIndex = Math.floor(Math.random() * storiesToUse.length);
  return storiesToUse[randomIndex];
}

export class QuestService {
  static async generateStory(studentId: string): Promise<QuestStory> {
    try {
      if (!process.env.API_KEY) {
        console.warn('Missing API_KEY, using fallback story');
        const story = getFallbackStory();
        return story;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 1. Fetch Student - use fallback if student not found
      const student = await db.getStudentById(studentId);
      if (!student) {
        console.warn(`Student ${studentId} not found, using fallback story`);
        const story = getFallbackStory();
        return story;
      }

      // 2. Fetch/Calculate Rank (Simulating kingdom_kids_profiles.current_rank by points)
      let rank = 'Seed';
      try {
        const leaderboard = await MinistryService.getLeaderboard(student.ageGroup);
        const entry = leaderboard.find(e => e.id === studentId);
        const totalPoints = entry?.totalPoints || 0;

        if (totalPoints >= 100) rank = 'Sprout';
        if (totalPoints >= 300) rank = 'Rooted';
        if (totalPoints >= 600) rank = 'Branch';
        if (totalPoints >= 1000) rank = 'Fruit Bearer';
      } catch (err) {
        console.warn('Failed to get rank, using default:', err);
      }

      // 3. Fetch History from Supabase
      let history: string[] = [];
      try {
        history = await db.getStoryHistory(studentId);
      } catch (err) {
        console.warn('Failed to get story history:', err);
      }

      // 4. Gemini Generation
      // Generate random number of questions between 10 and 50
      const questionCount = Math.floor(Math.random() * 41) + 10; // 10-50 questions

      const prompt = `
        Create a NEW Bible story for a child.
        Profile:
        - Rank: ${rank} (Adjust theological depth: Seed=Simple/Literal, Fruit Bearer=Application/Deeper Meaning)
        - Age Group: ${student.ageGroup}
        
        EXCLUDE these past topics: ${history.join(', ')}.
        
        Return JSON:
        - title: Fun title
        - content: Story body (50-80 words, short and engaging for kids, should take about 30 seconds to read)
        - quiz: ${questionCount} multiple choice questions with 4 options each
        - story_topic: Unique 1-3 word identifier for this story topic (e.g. "Daniel Lions", "Moses Red Sea").
      `;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                quiz: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      q: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      a: { type: Type.STRING }
                    },
                    required: ["q", "options", "a"]
                  }
                },
                story_topic: { type: Type.STRING }
              },
              required: ["title", "content", "quiz", "story_topic"]
            }
          }
        });

        const text = response.text;
        if (!text) {
          console.warn('No response from AI, using fallback story');
          return getFallbackStory(history);
        }

        const data = JSON.parse(text);

        // 5. Save Topic to Supabase to prevent repeats
        if (data.story_topic) {
          try {
            await db.addStoryHistory(studentId, data.story_topic);
          } catch (err) {
            console.error('Failed to save story history:', err);
          }
        }

        return {
          title: data.title,
          content: data.content,
          quiz: data.quiz,
          topic: data.story_topic
        };
      } catch (aiErr) {
        console.error('AI generation failed:', aiErr);
        return getFallbackStory(history);
      }
    } catch (err) {
      console.error('Story generation failed completely:', err);
      return getFallbackStory();
    }
  }

  static async completeQuest(studentId: string) {
    const PLANT_STAGES = ['Seed', 'Sprout', 'Rooted', 'Branch', 'Fruit Bearer'];
    const STORAGE_KEY = `quest_progress_${studentId}`;
    const STEP = 20;

    // 1. Award Points (best-effort — tolerate weak signal)
    try {
      await MinistryService.addPoints(studentId, 'Daily Quest', 5, 'System', 'Completed Daily Quest');
    } catch (err) {
      console.warn('Points sync failed, will retry when online:', err);
    }

    // 2. Read existing progress from localStorage (offline-first for weak signal).
    let stage = 0;
    let rankIndex = 0;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        stage = Number(parsed?.stage) || 0;
        rankIndex = Number(parsed?.rank) || 0;
      }
    } catch { /* ignore malformed cache */ }

    // 3. Advance progress. Each quest adds STEP; at 100 stage resets and rank advances (capped).
    let newStage = stage + STEP;
    let newRankIndex = rankIndex;
    if (newStage >= 100) {
      newStage = 0;
      newRankIndex = Math.min(rankIndex + 1, PLANT_STAGES.length - 1);
    }

    // 4. Persist locally FIRST so it survives weak signal / refresh.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ stage: newStage, rank: newRankIndex }));
    } catch { /* storage full or disabled */ }

    // 5. Best-effort sync to Supabase. Skip for guest demo.
    if (studentId !== 'GUEST_DEMO') {
      try {
        await db.updateProfile(studentId, {
          total_xp: newStage,
          current_plant_stage: newRankIndex + 1,
          current_rank: PLANT_STAGES[newRankIndex]
        });
      } catch (err) {
        console.warn('Profile sync to Supabase failed (will retry when online):', err);
      }
    }

    return { newStage, newRankIndex };
  }
}
