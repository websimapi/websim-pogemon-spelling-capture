import confetti from 'canvas-confetti';

export class UIManager {
    constructor() {
        this.initializeElements();
    }

    initializeElements() {
        this.difficultySelection = document.getElementById('difficulty-selection');
        this.gameArea = document.getElementById('game-area');
        this.backToMenuBtn = document.getElementById('back-to-menu-btn');
        this.speakWordBtn = document.getElementById('speak-word-btn');
        this.useInSentenceBtn = document.getElementById('use-in-sentence-btn');
        this.spellingDisplay = document.getElementById('spelling-display');
        this.hintDisplay = document.getElementById('hint-display');
        this.micBtn = document.getElementById('mic-btn');
        this.micStatus = document.getElementById('mic-status');
        this.gameMessage = document.getElementById('game-message');
        this.pogemonRevealContainer = document.getElementById('pogemon-reveal-container');
        this.pogemonCard = document.getElementById('pogemon-card');
        this.pogemonImageContainer = document.getElementById('card-pogemon-image-container');
        this.pogemonName = document.getElementById('card-pogemon-name');
        this.pogemonDescription = document.getElementById('card-pogemon-description');
        this.pogemonStats = document.getElementById('card-pogemon-stats');
        this.nextWordBtn = document.getElementById('next-word-btn');
        this.pogemonGallery = document.getElementById('pogemon-gallery');
        this.galleryGrid = document.getElementById('gallery-grid');
        this.collectionBtn = document.getElementById('collection-btn');
        this.scoreBtn = document.getElementById('score-btn');
        this.scoreView = document.getElementById('score-view');
        this.scoreDetails = document.getElementById('score-details');
    }

    showDifficultySelection() {
        this.gameArea.classList.add('hidden');
        this.pogemonGallery.classList.add('hidden');
        this.scoreView.classList.add('hidden');
        this.difficultySelection.classList.remove('hidden');
        this.backToMenuBtn.classList.add('hidden');
        this.collectionBtn.classList.remove('hidden');
        this.scoreBtn.classList.remove('hidden');
    }

    showGameArea() {
        this.difficultySelection.classList.add('hidden');
        this.gameArea.classList.remove('hidden');
        this.backToMenuBtn.classList.remove('hidden');
    }

    showGallery() {
        this.difficultySelection.classList.add('hidden');
        this.gameArea.classList.add('hidden');
        this.scoreView.classList.add('hidden');
        this.pogemonGallery.classList.remove('hidden');
        this.backToMenuBtn.classList.remove('hidden');
        this.collectionBtn.classList.add('hidden');
        this.scoreBtn.classList.add('hidden');
    }

    showScores() {
        this.difficultySelection.classList.add('hidden');
        this.gameArea.classList.add('hidden');
        this.pogemonGallery.classList.add('hidden');
        this.scoreView.classList.remove('hidden');
        this.backToMenuBtn.classList.remove('hidden');
        this.collectionBtn.classList.add('hidden');
        this.scoreBtn.classList.add('hidden');
    }

    setMessage(text, type = '') {
        this.gameMessage.textContent = text;
        this.gameMessage.className = `game-message ${type}`;
    }

    updateSpellingDisplay(wordLength) {
        this.spellingDisplay.innerHTML = '';
        if (wordLength === 0) return;

        for (let i = 0; i < wordLength; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 1;
            input.dataset.index = i;
            input.autocomplete = 'off';
            input.autocapitalize = 'off';
            this.spellingDisplay.appendChild(input);
        }
        return this.spellingDisplay.querySelector('input');
    }

    getUserSpelling() {
        const inputs = this.spellingDisplay.querySelectorAll('input');
        return Array.from(inputs).map(input => input.value).join('').toLowerCase();
    }

    disableSpellingInputs() {
        this.spellingDisplay.querySelectorAll('input').forEach(input => input.disabled = true);
    }

    clearSpellingInputs() {
        const inputs = this.spellingDisplay.querySelectorAll('input');
        inputs.forEach(input => input.value = '');
        return inputs[0];
    }

    addLetterToSpelling(letter) {
        const inputs = this.spellingDisplay.querySelectorAll('input');
        const targetInput = Array.from(inputs).find(input => !input.value);
        if (targetInput) {
            targetInput.value = letter;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    animateIncorrectSpelling() {
        return this.spellingDisplay.animate([
            { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }
        ], { duration: 300, iterations: 1 });
    }

    showConfetti() {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }

    updatePogemonCard(word, description, difficulty, isPreReveal = false) {
        if (isPreReveal) {
            this.pogemonCard.classList.add('pre-reveal');
            this.pogemonImageContainer.innerHTML = '<div class="card-back-content">?</div>';
            this.pogemonName.textContent = '?????';
            this.pogemonDescription.textContent = 'Spell the word to reveal this Pogemon!';
            this.pogemonStats.textContent = difficulty;
            this.nextWordBtn.classList.add('hidden');
        } else {
            this.pogemonName.textContent = word;
            this.pogemonDescription.textContent = description;
            this.pogemonCard.classList.remove('pre-reveal');
            this.pogemonImageContainer.innerHTML = '<div class="loader"></div>';
        }
    }

    async updatePogemonImage(description) {
        try {
            const result = await websim.imageGen({
                prompt: `${description}, cute friendly monster, pokemon style, cartoon character, vibrant colors, isolated on a plain white background, high quality digital illustration`,
                aspect_ratio: "1:1"
            });
            const img = document.createElement('img');
            img.src = result.url;
            this.pogemonImageContainer.innerHTML = '';
            this.pogemonImageContainer.appendChild(img);
            return result.url;
        } catch (error) {
            console.error('Image generation failed:', error);
            this.pogemonImageContainer.innerHTML = '<p>Could not generate image.</p>';
            throw error;
        }
    }

    updateGallery(collection) {
        if (collection.length === 0) {
             this.galleryGrid.innerHTML = '<p>Capture your first Pogemon to start your collection!</p>';
             return;
        }
        this.galleryGrid.innerHTML = '';
        collection.forEach(p => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <div class="gallery-card-image-container">
                    <img src="${p.imageUrl}" alt="${p.word}">
                </div>
                <div class="gallery-card-info">
                    <h3 class="gallery-card-name">${p.word}</h3>
                </div>
                <div class="tooltip">
                    <strong>${p.word}</strong>
                    <p>${p.description}</p>
                </div>
            `;
            this.galleryGrid.appendChild(item);
        });
    }

    renderScores(wordStats, currentStreaks, highestStreaks) {
        this.scoreDetails.innerHTML = '';
        
        const gradeLevels = [...new Set([...Object.keys(wordStats), ...Object.keys(highestStreaks)])];
        gradeLevels.sort();

        if (gradeLevels.length === 0) {
            this.scoreDetails.innerHTML = '<p>Play some rounds to see your scores and streaks!</p>';
            return;
        }

        let htmlContent = '';

        gradeLevels.forEach(grade => {
            const gradeStats = wordStats[grade];
            const highestStreak = highestStreaks[grade]?.highest || 0;
            const currentStreak = currentStreaks[grade] || 0;

            const streakHTML = `
                <div class="streak-info">
                    <p><strong>Highest Streak:</strong> ${highestStreak}</p>
                    <p><strong>Current Streak:</strong> ${currentStreak}</p>
                </div>
            `;

            let tableHTML = '';
            if (gradeStats) {
                const words = Object.values(gradeStats).filter(word => word.seenInInitialCycle);
                if (words.length > 0) {
                    words.sort((a, b) => b.totalIncorrect - a.totalIncorrect);
                    
                    const tableRows = words.map(wordData => `<tr><td>${wordData.word}</td><td>${wordData.totalCorrect || 0}</td><td>${wordData.totalIncorrect}</td></tr>`).join('');
                    
                    tableHTML = `
                        <table>
                            <thead>
                                <tr>
                                    <th>Word</th>
                                    <th>Correct</th>
                                    <th>Incorrect Attempts</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    `;
                }
            }
            
            if (highestStreak > 0 || tableHTML) {
                htmlContent += `
                    <div class="grade-scores">
                        <h3>${grade}</h3>
                        ${streakHTML}
                        ${tableHTML || '<p>No words played in this grade yet.</p>'}
                    </div>
                `;
            }
        });

        if (htmlContent) {
            this.scoreDetails.innerHTML = htmlContent;
        } else {
            this.scoreDetails.innerHTML = '<p>Play some rounds to see your scores and streaks!</p>';
        }
    }

    updateHint(currentWord, hintsGiven, revealedIndices) {
        if (hintsGiven === 1) {
            this.hintDisplay.innerHTML = `<p style="width:100%; margin-bottom:5px;">Hint: The word has ${currentWord.length} letters.</p>`;
            for (let i = 0; i < currentWord.length; i++) {
                const box = document.createElement('div');
                box.className = 'letter-box';
                this.hintDisplay.appendChild(box);
            }
        } else {
            const hintBoxes = this.hintDisplay.querySelectorAll('.letter-box');
            if (hintBoxes.length === 0) return null;

            const unrevealedIndices = [...Array(currentWord.length).keys()].filter(i => !revealedIndices.has(i));
            if (unrevealedIndices.length > 1) {
                const indexToReveal = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
                revealedIndices.add(indexToReveal);
                hintBoxes[indexToReveal].textContent = currentWord[indexToReveal];
                return indexToReveal;
            }
        }
        return null;
    }

    resetRoundUI(difficulty) {
        this.updatePogemonCard('', '', difficulty, true);
        this.nextWordBtn.classList.add('hidden');
        this.setMessage('');
        this.hintDisplay.innerHTML = '';
        this.spellingDisplay.innerHTML = '';
        this.useInSentenceBtn.disabled = false;
        this.useInSentenceBtn.querySelector('span').textContent = 'Use in Sentence';
    }

    updateMicButton(isRecording, isSupported) {
        if (!isSupported) {
            this.micBtn.disabled = true;
            this.micStatus.textContent = 'Not Supported';
            return;
        }

        if (isRecording) {
            this.micBtn.classList.add('recording');
            this.micStatus.textContent = 'Listening...';
        } else {
            this.micBtn.classList.remove('recording');
            this.micStatus.textContent = 'Use Mic';
        }
    }

    updateSentenceButton(isLoading) {
        if (isLoading) {
            this.useInSentenceBtn.disabled = true;
            this.useInSentenceBtn.querySelector('span').textContent = 'Thinking...';
        } else {
            this.useInSentenceBtn.querySelector('span').textContent = 'Use in Sentence';
        }
    }
}