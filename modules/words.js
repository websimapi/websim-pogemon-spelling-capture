export class WordManager {
    constructor() {
        this.firstGradeWords = [];
        this.secondGradeWords = [];
        this.wordsForCurrentCycle = [];
    }

    async loadFirstGradeWords() {
        try {
            const response = await fetch('./1st_grade_words.json');
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            this.firstGradeWords = await response.json();
            return this.firstGradeWords;
        } catch (error) {
            console.error('Failed to load 1st grade words:', error);
            throw error;
        }
    }

    async loadSecondGradeWords() {
        try {
            // Load both grade levels for 2nd grade
            const [firstGradeResponse, secondGradeResponse] = await Promise.all([
                fetch('./1st_grade_words.json'),
                fetch('./2nd_grade_words.json')
            ]);
            
            if (!firstGradeResponse.ok || !secondGradeResponse.ok) {
                throw new Error('Failed to load grade level words');
            }
            
            this.firstGradeWords = await firstGradeResponse.json();
            this.secondGradeWords = await secondGradeResponse.json();
            
            return { firstGrade: this.firstGradeWords, secondGrade: this.secondGradeWords };
        } catch (error) {
            console.error('Failed to load grade level words:', error);
            throw error;
        }
    }

    prepareWordCycle(gradeStats) {
        if (!gradeStats) return [];
        
        const allWords = Object.values(gradeStats);

        // Phase 1: Show all words that haven't been seen in the initial cycle
        const unseenInitialWords = allWords.filter(word => !word.seenInInitialCycle);
        if (unseenInitialWords.length > 0) {
            this.wordsForCurrentCycle = this.shuffle(unseenInitialWords);
            return this.wordsForCurrentCycle;
        }

        // Phase 2: All words seen at least once, now sort by score
        const sortedWords = [...allWords].sort((a, b) => b.totalIncorrect - a.totalIncorrect);
        const middleIndex = Math.ceil(sortedWords.length / 2);
        const lowScorers = sortedWords.slice(0, middleIndex);
        const highScorers = sortedWords.slice(middleIndex);

        this.wordsForCurrentCycle = [...this.shuffle(lowScorers), ...this.shuffle(highScorers)];
        return this.wordsForCurrentCycle;
    }

    getNextWordFromCycle() {
        return this.wordsForCurrentCycle.shift();
    }

    getRandomFirstGradeWord() {
        if (this.firstGradeWords.length === 0) return null;
        return this.firstGradeWords[Math.floor(Math.random() * this.firstGradeWords.length)];
    }

    shuffle(array) {
        // Fisher-Yates shuffle
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    initializeWordStats(wordList, gradeLevel, existingStats = {}) {
        if (!existingStats[gradeLevel]) {
            existingStats[gradeLevel] = {};
        }

        wordList.forEach(wordObj => {
            if (!existingStats[gradeLevel][wordObj.word]) {
                existingStats[gradeLevel][wordObj.word] = {
                    totalIncorrect: 0,
                    totalCorrect: 0,
                    seenInInitialCycle: false,
                    ...wordObj
                };
            } else {
                // Backwards compatibility for old save data
                const wordStats = existingStats[gradeLevel][wordObj.word];
                if (wordStats.totalCorrect === undefined) {
                    wordStats.totalCorrect = 0;
                }
            }
        });

        return existingStats;
    }

    async generateLLMWord(difficulty) {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a game master for a spelling game. You provide age-appropriate words and creative creature descriptions based on those words. The word must be a single word, containing no spaces or hyphens. Respond directly with JSON, following this JSON schema, and no other text: { "word": "string", "description": "string" }`
                },
                {
                    role: 'user',
                    content: `Generate a single, non-hyphenated word for a ${difficulty} level speller. The description should be for a fantasy creature, called a "Pogemon", whose characteristics are inspired by the word's meaning or sound.`
                }
            ],
            json: true,
        });

        const result = JSON.parse(completion.content);
        return {
            word: result.word.toLowerCase().trim().replace(/[^a-z]/gi, ''),
            description_prompt: result.description
        };
    }

    async generateSentence(word, difficulty) {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You generate simple sentences for a spelling game. Respond directly with JSON, following this JSON schema, and no other text: { "sentence": "string" }`,
                },
                {
                    role: 'user',
                    content: `Create a simple, age-appropriate sentence for a ${difficulty} level speller using the word "${word}".`,
                },
            ],
            json: true,
        });

        const result = JSON.parse(completion.content);
        return result.sentence;
    }
}