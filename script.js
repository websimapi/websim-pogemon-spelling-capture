import { playSound, speak, cancelSpeech, audioContext } from './modules/audio.js';
import { StorageManager } from './modules/storage.js';
import { SpeechManager } from './modules/speech.js';
import { WordManager } from './modules/words.js';
import { UIManager } from './modules/ui.js';

class Game {
    constructor() {
        this.ui = new UIManager();
        this.storage = new StorageManager();
        this.speechManager = new SpeechManager();
        this.wordManager = new WordManager();
        
        // Game State
        this.difficulty = '3rd Grade';
        this.currentWord = '';
        this.currentDescription = '';
        this.currentWordObject = null;
        this.crossGradeLevel = null;
        this.userSpelling = [];
        this.wrongAttempts = 0;
        this.hintsGiven = 0;
        this.revealedIndices = new Set();
        this.collectedPogemon = [];
        this.wordStats = {};
        this.currentStreaks = {};
        this.highestStreaks = {};
        this.isChecking = false;
    }

    init() {
        this.addEventListeners();
        this.setupSpeechCallbacks();
        this.loadDataFromStorage();
        this.ui.updateMicButton(false, this.speechManager.isSupported());
    }

    addEventListeners() {
        this.ui.difficultySelection.addEventListener('click', async (e) => {
            if (e.target.tagName === 'BUTTON') {
                if (audioContext.state === 'suspended') {
                    audioContext.resume();
                }
                this.difficulty = e.target.dataset.level;
                this.ui.showGameArea();
                
                if (this.difficulty === '1st Grade') {
                    await this.setupFirstGradeLevel();
                } else if (this.difficulty === '2nd Grade') {
                    await this.setupSecondGradeLevel();
                }
                
                await this.startNewRound();
            }
        });

        this.ui.backToMenuBtn.addEventListener('click', () => this.goBackToMenu());
        this.ui.speakWordBtn.addEventListener('click', () => speak(this.currentWord));
        this.ui.useInSentenceBtn.addEventListener('click', () => this.getAndSpeakSentence());
        this.ui.nextWordBtn.addEventListener('click', () => this.startNewRound());
        this.ui.micBtn.addEventListener('click', () => this.toggleMic());
        this.ui.collectionBtn.addEventListener('click', () => this.showGallery());
        this.ui.scoreBtn.addEventListener('click', () => this.showScores());

        // Spelling input event delegation
        this.ui.spellingDisplay.addEventListener('input', (e) => this.handleSpellingInput(e));
        this.ui.spellingDisplay.addEventListener('keydown', (e) => this.handleSpellingKeyDown(e));
        this.ui.spellingDisplay.addEventListener('paste', (e) => this.handleSpellingPaste(e));
    }

    setupSpeechCallbacks() {
        this.speechManager.setCallbacks({
            onLetter: (letter) => this.ui.addLetterToSpelling(letter),
            onError: (message) => {
                this.ui.setMessage(message, 'incorrect');
                setTimeout(() => this.ui.setMessage(''), 1500);
            },
            onStart: () => this.ui.updateMicButton(true, true),
            onEnd: () => this.ui.updateMicButton(false, true)
        });
    }

    loadDataFromStorage() {
        this.collectedPogemon = this.storage.loadCollection();
        this.wordStats = this.storage.loadWordStats();
        this.highestStreaks = this.storage.loadStreak();
        this.currentStreaks = {};
        this.ui.updateGallery(this.collectedPogemon);
    }

    goBackToMenu() {
        this.ui.showDifficultySelection();
        cancelSpeech();
        if (this.ui.micBtn.classList.contains('recording')) {
            this.speechManager.stopListening();
        }
        this.ui.setMessage('');
        this.currentStreaks = {};
    }

    showGallery() {
        this.ui.showGallery();
        cancelSpeech();
        if (this.ui.micBtn.classList.contains('recording')) {
            this.speechManager.stopListening();
        }
        this.ui.setMessage('');
    }

    showScores() {
        this.ui.showScores();
        cancelSpeech();
        if (this.ui.micBtn.classList.contains('recording')) {
            this.speechManager.stopListening();
        }
        this.ui.renderScores(this.wordStats, this.currentStreaks, this.highestStreaks);
        this.ui.setMessage('');
    }

    async setupFirstGradeLevel() {
        this.ui.setMessage('Loading 1st grade words...', 'loading');
        try {
            const wordList = await this.wordManager.loadFirstGradeWords();
            this.wordStats = this.wordManager.initializeWordStats(wordList, '1st Grade', this.wordStats);
            this.storage.saveWordStats(this.wordStats);
            this.wordManager.prepareWordCycle(this.wordStats['1st Grade']);
        } catch (error) {
            console.error('Failed to load 1st grade words:', error);
            this.ui.setMessage('Could not load words. Reverting to default.', 'incorrect');
            this.difficulty = '3rd Grade';
        }
    }

    async setupSecondGradeLevel() {
        this.ui.setMessage('Loading 2nd grade words...', 'loading');
        try {
            const { firstGrade, secondGrade } = await this.wordManager.loadSecondGradeWords();
            
            this.wordStats = this.wordManager.initializeWordStats(firstGrade, '1st Grade', this.wordStats);
            this.wordStats = this.wordManager.initializeWordStats(secondGrade, '2nd Grade', this.wordStats);
            this.storage.saveWordStats(this.wordStats);
            this.wordManager.prepareWordCycle(this.wordStats['2nd Grade']);
        } catch (error) {
            console.error('Failed to load grade level words:', error);
            this.ui.setMessage('Could not load words. Reverting to default.', 'incorrect');
            this.difficulty = '3rd Grade';
        }
    }

    async startNewRound() {
        this.resetRoundState();

        if (this.difficulty === '1st Grade') {
            this.startFirstGradeRound();
        } else if (this.difficulty === '2nd Grade') {
            this.startSecondGradeRound();
        } else {
            await this.startLLMRound();
        }
    }

    startFirstGradeRound() {
        this.currentWordObject = this.wordManager.getNextWordFromCycle();
        if (!this.currentWordObject) {
            this.wordManager.prepareWordCycle(this.wordStats['1st Grade']);
            this.currentWordObject = this.wordManager.getNextWordFromCycle();
        }

        if (!this.currentWordObject) {
            this.ui.setMessage('Error: No words available.', 'incorrect');
            return;
        }
        
        this.currentWord = this.currentWordObject.word.toLowerCase().trim();
        this.currentDescription = this.currentWordObject.description_prompt;
        speak(this.currentWord);
        this.ui.updateSpellingDisplay(this.currentWord.length)?.focus();
    }
    
    startSecondGradeRound() {
        // 1/8 chance to get a word from the grade below
        if (Math.random() < 0.125) {
            this.currentWordObject = this.wordManager.getRandomFirstGradeWord();
            this.crossGradeLevel = '1st Grade';
        } else {
            this.currentWordObject = this.wordManager.getNextWordFromCycle();
            if (!this.currentWordObject) {
                this.wordManager.prepareWordCycle(this.wordStats['2nd Grade']);
                this.currentWordObject = this.wordManager.getNextWordFromCycle();
            }
            this.crossGradeLevel = null;
        }

        if (!this.currentWordObject) {
            this.ui.setMessage('Error: No 2nd grade words available.', 'incorrect');
            return;
        }

        this.currentWord = this.currentWordObject.word.toLowerCase().trim();
        this.currentDescription = this.currentWordObject.description_prompt;
        speak(this.currentWord);
        this.ui.updateSpellingDisplay(this.currentWord.length)?.focus();
    }
    
    async startLLMRound() {
        this.ui.setMessage('Getting a new word...', 'loading');
        try {
            this.currentWordObject = await this.wordManager.generateLLMWord(this.difficulty);
            this.currentWord = this.currentWordObject.word;
            this.currentDescription = this.currentWordObject.description_prompt;
            
            this.ui.setMessage('');
            speak(this.currentWord);
            this.ui.updateSpellingDisplay(this.currentWord.length)?.focus();
        } catch (error) {
            console.error('Error fetching new word:', error);
            this.ui.setMessage('Could not get a new word. Please try again.', 'incorrect');
        }
    }
    
    resetRoundState() {
        this.ui.resetRoundUI(this.difficulty);
        this.userSpelling = [];
        this.wrongAttempts = 0;
        this.hintsGiven = 0;
        this.isChecking = false;
        this.currentWordObject = null;
        this.crossGradeLevel = null;
        this.revealedIndices.clear();
    }

    handleSpellingInput(e) {
        const input = e.target;
        if (input.tagName !== 'INPUT') return;
        
        const value = input.value;

        if (value.match(/^[a-z]$/i)) {
            const index = parseInt(input.dataset.index, 10);
            const nextInput = this.ui.spellingDisplay.querySelector(`input[data-index="${index + 1}"]`);
            if (nextInput) {
                nextInput.focus();
            } else {
                this.checkSpelling();
            }
        } else if (value) {
            input.value = '';
        }
    }

    handleSpellingKeyDown(e) {
        const input = e.target;
        if (input.tagName !== 'INPUT') return;
        
        const index = parseInt(input.dataset.index, 10);

        if (e.key === 'Backspace' && input.value === '') {
            e.preventDefault();
            const prevInput = this.ui.spellingDisplay.querySelector(`input[data-index="${index - 1}"]`);
            if (prevInput) {
                prevInput.focus();
            }
        } else if (e.key === 'ArrowLeft') {
            const prevInput = this.ui.spellingDisplay.querySelector(`input[data-index="${index - 1}"]`);
            if (prevInput) prevInput.focus();
        } else if (e.key === 'ArrowRight') {
            const nextInput = this.ui.spellingDisplay.querySelector(`input[data-index="${index + 1}"]`);
            if (nextInput) nextInput.focus();
        }
    }
    
    handleSpellingPaste(e) {
        if (e.target.tagName !== 'INPUT') return;
        
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').toLowerCase().replace(/[^a-z]/g, '');
        const inputs = this.ui.spellingDisplay.querySelectorAll('input');
        
        for (let i = 0; i < pasteData.length; i++) {
            if (inputs[i]) {
                inputs[i].value = pasteData[i];
            }
        }
        this.checkSpelling();
    }

    async getAndSpeakSentence() {
        if (!this.currentWord) return;

        this.ui.updateSentenceButton(true);

        try {
            const sentence = await this.wordManager.generateSentence(this.currentWord, this.difficulty);
            this.ui.pogemonDescription.textContent = this.currentDescription;
            speak(sentence);

            const regex = new RegExp(`\\b${this.currentWord}\\b`, 'gi');
            const obfuscatedSentence = sentence.replace(regex, '____');
            this.ui.setMessage(obfuscatedSentence, 'hint-sentence');
            this.ui.updateSentenceButton(false);
        } catch (error) {
            console.error('Error fetching sentence:', error);
            this.ui.setMessage('Could not get a sentence. Please try again.', 'incorrect');
            this.ui.useInSentenceBtn.disabled = false;
        }
    }

    checkSpelling() {
        if(this.isChecking) return;
        this.isChecking = true;

        const spelledWord = this.ui.getUserSpelling();

        if (spelledWord === this.currentWord) {
            this.handleCorrectSpelling();
        } else {
            this.handleIncorrectSpelling();
        }
    }

    async handleCorrectSpelling() {
        playSound('./correct.mp3');
        this.ui.setMessage('Correct!', 'correct');
        this.ui.disableSpellingInputs();
        this.ui.nextWordBtn.classList.add('hidden');
        this.ui.updatePogemonCard(this.currentWord, this.currentDescription, this.difficulty);
        this.ui.showConfetti();
        
        this.updateStreaks();
        this.updateWordStats();

        try {
            const imageUrl = await this.ui.updatePogemonImage(this.currentDescription);
            const captured = {
                word: this.currentWord,
                description: this.currentDescription,
                imageUrl: imageUrl
            };
            this.collectedPogemon.push(captured);
            this.storage.saveCollection(this.collectedPogemon);
            this.ui.updateGallery(this.collectedPogemon);
        } catch (error) {
            console.error('Image generation failed:', error);
        } finally {
            this.ui.nextWordBtn.classList.remove('hidden');
        }
    }

    handleIncorrectSpelling() {
        playSound('./incorrect.mp3');
        this.ui.setMessage('Try again!', 'incorrect');
        this.wrongAttempts++;
        const gradeForStreak = this.crossGradeLevel || this.difficulty;
        this.currentStreaks[gradeForStreak] = 0;
        
        this.ui.animateIncorrectSpelling();

        setTimeout(() => {
            const firstInput = this.ui.clearSpellingInputs();
            this.ui.setMessage('');
            firstInput?.focus();
            this.isChecking = false;
        }, 1000);

        if (this.wrongAttempts >= 3) {
            this.giveHint();
        }
    }
    
    updateStreaks() {
        if (this.wrongAttempts === 0) {
            const gradeForStreak = this.crossGradeLevel || this.difficulty;
            
            if (!this.currentStreaks[gradeForStreak]) {
                this.currentStreaks[gradeForStreak] = 0;
            }
            if (!this.highestStreaks[gradeForStreak]) {
                this.highestStreaks[gradeForStreak] = { highest: 0 };
            }

            this.currentStreaks[gradeForStreak]++;
            this.highestStreaks[gradeForStreak].highest = Math.max(
                this.highestStreaks[gradeForStreak].highest,
                this.currentStreaks[gradeForStreak]
            );
            this.storage.saveStreak(this.highestStreaks);
        }
    }

    updateWordStats() {
        const gradeForStats = this.crossGradeLevel || this.difficulty;
        if (this.currentWordObject) {
            if (!this.wordStats[gradeForStats]) {
                this.wordStats[gradeForStats] = {};
            }
            
            let stats = this.wordStats[gradeForStats][this.currentWordObject.word];
            
            if (!stats) {
                stats = {
                    totalIncorrect: 0,
                    totalCorrect: 0,
                    seenInInitialCycle: false,
                    ...this.currentWordObject
                };
                this.wordStats[gradeForStats][this.currentWordObject.word] = stats;
            }

            stats.totalIncorrect += this.wrongAttempts;
            stats.totalCorrect = (stats.totalCorrect || 0) + 1;
            stats.seenInInitialCycle = true;
            this.storage.saveWordStats(this.wordStats);
        }
    }
    
    giveHint() {
        this.hintsGiven++;
        const revealed = this.ui.updateHint(this.currentWord, this.hintsGiven, this.revealedIndices);
        if (revealed !== null) {
            this.revealedIndices.add(revealed);
        }
    }

    toggleMic() {
        if (this.ui.micBtn.classList.contains('recording')) {
            this.speechManager.stopListening();
        } else {
            const firstInput = this.ui.spellingDisplay.querySelector('input');
            if (firstInput && firstInput.disabled) return;
            this.speechManager.startListening();
        }
    }
}

const game = new Game();
game.init();