import confetti from 'canvas-confetti';

const game = {
    // DOM Elements
    difficultySelection: document.getElementById('difficulty-selection'),
    gameArea: document.getElementById('game-area'),
    speakWordBtn: document.getElementById('speak-word-btn'),
    spellingDisplay: document.getElementById('spelling-display'),
    hintDisplay: document.getElementById('hint-display'),
    letterInput: document.getElementById('letter-input'),
    micBtn: document.getElementById('mic-btn'),
    micStatus: document.getElementById('mic-status'),
    gameMessage: document.getElementById('game-message'),
    pogemonReveal: document.getElementById('pogemon-reveal'),
    pogemonImageContainer: document.getElementById('pogemon-image-container'),
    pogemonName: document.getElementById('pogemon-name'),
    pogemonDescription: document.getElementById('pogemon-description'),
    nextWordBtn: document.getElementById('next-word-btn'),
    galleryGrid: document.getElementById('gallery-grid'),

    // Game State
    difficulty: '3rd Grade',
    currentWord: '',
    currentDescription: '',
    currentWordObject: null, // For 1st grade word data
    userSpelling: [],
    wrongAttempts: 0,
    hintsGiven: 0,
    revealedIndices: new Set(),
    collectedPogemon: [],
    pogemonCollectionKey: 'pogemon-collection',
    wordStats: {},
    wordStatsKey: 'pogemon-word-stats',
    wordsForCurrentCycle: [],
    speechRecognition: null,
    isChecking: false,

    init() {
        this.addEventListeners();
        this.setupSpeechRecognition();
        this.loadCollectionFromStorage();
        this.loadWordStats();
    },

    addEventListeners() {
        this.difficultySelection.addEventListener('click', async (e) => {
            if (e.target.tagName === 'BUTTON') {
                this.difficulty = e.target.dataset.level;
                this.difficultySelection.classList.add('hidden');
                this.gameArea.classList.remove('hidden');
                
                if (this.difficulty === '1st Grade') {
                    await this.setupFirstGradeLevel();
                }
                
                await this.startNewRound();
            }
        });

        this.speakWordBtn.addEventListener('click', () => this.speak(this.currentWord));
        this.nextWordBtn.addEventListener('click', () => this.startNewRound());
        this.letterInput.addEventListener('input', (e) => this.handleTextInput(e));
        this.letterInput.addEventListener('keydown', (e) => {
             if (e.key === 'Enter' && this.userSpelling.length === this.currentWord.length) {
                this.checkSpelling();
            }
        });
        this.micBtn.addEventListener('click', () => this.toggleMic());
    },

    async setupFirstGradeLevel() {
        this.setMessage('Loading 1st grade words...', 'loading');
        try {
            const response = await fetch('./1st_grade_words.json');
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const wordList = await response.json();

            // Initialize stats if not present for this level
            if (!this.wordStats['1st Grade']) {
                this.wordStats['1st Grade'] = {};
                wordList.forEach(wordObj => {
                    this.wordStats['1st Grade'][wordObj.word] = {
                        totalIncorrect: 0,
                        seenInInitialCycle: false,
                        ...wordObj
                    };
                });
                this.saveWordStats();
            }
            
            this.prepareWordCycle();

        } catch (error) {
            console.error('Failed to load 1st grade words:', error);
            this.setMessage('Could not load words. Reverting to default.', 'incorrect');
            this.difficulty = '3rd Grade'; // Revert to a working mode that uses the LLM
        }
    },

    prepareWordCycle() {
        const gradeStats = this.wordStats['1st Grade'];
        if (!gradeStats) return;
        const allWords = Object.values(gradeStats);

        // Phase 1: Show all words that haven't been seen in the initial cycle
        const unseenInitialWords = allWords.filter(word => !word.seenInInitialCycle);
        if (unseenInitialWords.length > 0) {
            this.wordsForCurrentCycle = this.shuffle(unseenInitialWords);
            return;
        }

        // Phase 2: All words seen at least once, now sort by score
        const sortedWords = [...allWords].sort((a, b) => b.totalIncorrect - a.totalIncorrect);
        const middleIndex = Math.ceil(sortedWords.length / 2);
        const lowScorers = sortedWords.slice(0, middleIndex);
        const highScorers = sortedWords.slice(middleIndex);

        this.wordsForCurrentCycle = [...this.shuffle(lowScorers), ...this.shuffle(highScorers)];
    },

    shuffle(array) {
        // Fisher-Yates shuffle
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    async startNewRound() {
        this.resetRoundState();

        if (this.difficulty === '1st Grade') {
            this.startFirstGradeRound();
        } else {
            await this.startLLMRound();
        }
    },

    startFirstGradeRound() {
        if (this.wordsForCurrentCycle.length === 0) {
            this.prepareWordCycle();
        }

        if (this.wordsForCurrentCycle.length === 0) {
            this.setMessage('Error: No words available.', 'incorrect');
            console.error("Could not prepare a new word cycle for 1st grade.");
            return;
        }
        
        this.currentWordObject = this.wordsForCurrentCycle.shift();
        this.currentWord = this.currentWordObject.word.toLowerCase().trim();
        this.currentDescription = this.currentWordObject.description_prompt;

        this.pogemonName.textContent = this.currentWord;
        this.pogemonDescription.textContent = this.currentDescription;

        this.setMessage('');
        this.speak(this.currentWord);
        this.updateSpellingDisplay();
    },
    
    async startLLMRound() {
        this.setMessage('Getting a new word...', 'loading');

        try {
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are a game master for a spelling game. You provide age-appropriate words and creative creature descriptions based on those words. The word must be a single word, containing no spaces or hyphens. Respond directly with JSON, following this JSON schema, and no other text: { "word": "string", "description": "string" }`
                    },
                    {
                        role: 'user',
                        content: `Generate a single, non-hyphenated word for a ${this.difficulty} level speller. The description should be for a fantasy creature, called a "Pogemon", whose characteristics are inspired by the word's meaning or sound.`
                    }
                ],
                json: true,
            });

            const result = JSON.parse(completion.content);
            this.currentWord = result.word.toLowerCase().trim().replace(/[^a-z]/gi, '');
            this.currentDescription = result.description;
            
            this.pogemonName.textContent = this.currentWord;
            this.pogemonDescription.textContent = this.currentDescription;

            this.setMessage('');
            this.speak(this.currentWord);
            this.updateSpellingDisplay();
        } catch (error) {
            console.error('Error fetching new word:', error);
            this.setMessage('Could not get a new word. Please try again.', 'incorrect');
        }
    },
    
    resetRoundState() {
        this.pogemonReveal.classList.add('hidden');
        this.gameArea.classList.remove('hidden');
        this.userSpelling = [];
        this.wrongAttempts = 0;
        this.hintsGiven = 0;
        this.isChecking = false;
        this.currentWordObject = null;
        this.revealedIndices.clear();
        this.letterInput.value = '';
        this.letterInput.disabled = false;
        this.letterInput.focus();
        this.hintDisplay.innerHTML = '';
        this.pogemonImageContainer.innerHTML = '<div class="loader"></div>';
        this.updateSpellingDisplay();
    },

    speak(text) {
        if (!text || typeof window.speechSynthesis === 'undefined') {
            console.warn('Speech synthesis not supported or no text to speak.');
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    },
    
    handleTextInput(e) {
        const letter = e.target.value.toLowerCase();
        if (letter && /^[a-z]$/.test(letter) && this.userSpelling.length < this.currentWord.length) {
            this.addLetter(letter);
        }
        setTimeout(() => e.target.value = '', 0);
    },
    
    addLetter(letter) {
        if (this.userSpelling.length < this.currentWord.length) {
            this.userSpelling.push(letter);
            this.updateSpellingDisplay();

            if (this.userSpelling.length === this.currentWord.length) {
                this.checkSpelling();
            }
        }
    },

    updateSpellingDisplay() {
        this.spellingDisplay.innerHTML = '';
        const len = this.currentWord.length || this.userSpelling.length || 0;
        for (let i = 0; i < len; i++) {
            const letter = this.userSpelling[i] || '';
            const box = document.createElement('div');
            box.className = 'letter-box';
            box.textContent = letter;
            this.spellingDisplay.appendChild(box);
        }
    },

    checkSpelling() {
        if(this.isChecking) return;
        this.isChecking = true;

        const spelledWord = this.userSpelling.join('');
        if (spelledWord === this.currentWord) {
            this.handleCorrectSpelling();
        } else {
            this.handleIncorrectSpelling();
        }
    },

    async handleCorrectSpelling() {
        this.setMessage('Correct!', 'correct');
        this.letterInput.disabled = true;
        this.pogemonReveal.classList.remove('hidden');
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });

        // Update stats for 1st grade level before generating image
        if (this.difficulty === '1st Grade' && this.currentWordObject) {
            const stats = this.wordStats['1st Grade'][this.currentWordObject.word];
            if (stats) {
                stats.totalIncorrect += this.wrongAttempts;
                stats.seenInInitialCycle = true;
                this.saveWordStats();
            }
        }

        try {
            const result = await websim.imageGen({
                prompt: `${this.currentDescription}, cute friendly monster, pokemon style, cartoon character, vibrant colors, isolated on a plain white background, high quality digital illustration`,
                aspect_ratio: "1:1"
            });
            const img = document.createElement('img');
            img.src = result.url;
            this.pogemonImageContainer.innerHTML = '';
            this.pogemonImageContainer.appendChild(img);

            const captured = {
                word: this.currentWord,
                description: this.currentDescription,
                imageUrl: result.url
            };
            this.collectedPogemon.push(captured);
            this.saveCollectionToStorage();
            this.updateGallery();
        } catch (error) {
            console.error('Image generation failed:', error);
            this.pogemonImageContainer.innerHTML = '<p>Could not generate image.</p>';
        }
    },

    handleIncorrectSpelling() {
        this.setMessage('Try again!', 'incorrect');
        this.wrongAttempts++;
        
        this.spellingDisplay.animate([
            { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }
        ], { duration: 300, iterations: 1 });

        setTimeout(() => {
            this.userSpelling = [];
            this.updateSpellingDisplay();
            this.setMessage('');
            this.letterInput.focus();
            this.isChecking = false;
        }, 1000);

        if (this.wrongAttempts >= 3) {
            this.giveHint();
        }
    },
    
    giveHint() {
        this.hintsGiven++;
        if (this.hintsGiven === 1) { // First hint: show word length
            this.hintDisplay.innerHTML = `<p style="width:100%; margin-bottom:5px;">Hint: The word has ${this.currentWord.length} letters.</p>`;
            for (let i = 0; i < this.currentWord.length; i++) {
                const box = document.createElement('div');
                box.className = 'letter-box';
                this.hintDisplay.appendChild(box);
            }
        } else { // Subsequent hints: reveal a letter
            const hintBoxes = this.hintDisplay.querySelectorAll('.letter-box');
            if (hintBoxes.length === 0) return;

            const unrevealedIndices = [...Array(this.currentWord.length).keys()].filter(i => !this.revealedIndices.has(i));
            if (unrevealedIndices.length > 1) { // Don't reveal the very last letter
                const indexToReveal = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
                this.revealedIndices.add(indexToReveal);
                hintBoxes[indexToReveal].textContent = this.currentWord[indexToReveal];
            }
        }
    },

    updateGallery() {
        if (this.collectedPogemon.length === 0) {
             this.galleryGrid.innerHTML = '<p>Capture your first Pogemon to start your collection!</p>';
             return;
        }
        this.galleryGrid.innerHTML = '';
        this.collectedPogemon.forEach(p => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <img src="${p.imageUrl}" alt="${p.word}">
                <div class="tooltip">
                    <strong>${p.word}</strong>
                    <p>${p.description}</p>
                </div>
            `;
            this.galleryGrid.appendChild(item);
        });
    },

    setMessage(text, type = '') {
        this.gameMessage.textContent = text;
        this.gameMessage.className = `game-message ${type}`;
    },

    loadCollectionFromStorage() {
        const savedCollection = localStorage.getItem(this.pogemonCollectionKey);
        if (savedCollection) {
            try {
                this.collectedPogemon = JSON.parse(savedCollection);
                this.updateGallery();
            } catch (e) {
                console.error("Error loading collection from local storage:", e);
                localStorage.removeItem(this.pogemonCollectionKey);
                this.collectedPogemon = [];
            }
        }
    },

    saveCollectionToStorage() {
        try {
            localStorage.setItem(this.pogemonCollectionKey, JSON.stringify(this.collectedPogemon));
        } catch (e) {
            console.error("Error saving collection to local storage:", e);
        }
    },
    
    loadWordStats() {
        const savedStats = localStorage.getItem(this.wordStatsKey);
        if (savedStats) {
            try {
                this.wordStats = JSON.parse(savedStats);
            } catch (e) {
                console.error("Error loading word stats from local storage:", e);
                localStorage.removeItem(this.wordStatsKey);
                this.wordStats = {};
            }
        }
    },

    saveWordStats() {
        try {
            localStorage.setItem(this.wordStatsKey, JSON.stringify(this.wordStats));
        } catch (e) {
            console.error("Error saving word stats to local storage:", e);
        }
    },
    
    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.micBtn.disabled = true;
            this.micStatus.textContent = 'Not Supported';
            return;
        }

        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = false;
        this.speechRecognition.lang = 'en-US';
        this.speechRecognition.interimResults = false;

        this.speechRecognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
            const lastChar = transcript.slice(-1);

            if (/[a-z]/.test(lastChar)) {
                 this.addLetter(lastChar);
                 this.letterInput.value = '';
            } else {
                this.setMessage('Please say a single letter.', 'incorrect');
                setTimeout(() => this.setMessage(''), 1500);
            }
        };

        this.speechRecognition.onspeechend = () => this.speechRecognition.stop();
        
        this.speechRecognition.onstart = () => {
            this.micBtn.classList.add('recording');
            this.micStatus.textContent = 'Listening...';
        };

        this.speechRecognition.onend = () => {
            this.micBtn.classList.remove('recording');
            this.micStatus.textContent = 'Use Mic';
        };

        this.speechRecognition.onerror = (event) => {
             console.error('Speech recognition error', event.error);
             if (event.error !== 'no-speech') {
                this.setMessage('Mic error. Try typing.', 'incorrect');
             }
        };
    },
    
    toggleMic() {
        if (this.micBtn.classList.contains('recording')) {
            this.speechRecognition.stop();
        } else {
            if (this.letterInput.disabled) return;
            try {
                this.speechRecognition.start();
            } catch(e) {
                console.error("Mic already started", e);
            }
        }
    }
};

game.init();