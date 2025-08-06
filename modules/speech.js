export class SpeechManager {
    constructor() {
        this.speechRecognition = null;
        this.onLetterCallback = null;
        this.onErrorCallback = null;
        this.setupSpeechRecognition();
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            return false;
        }

        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = false;
        this.speechRecognition.lang = 'en-US';
        this.speechRecognition.interimResults = false;

        this.speechRecognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
            const lastChar = transcript.slice(-1);

            if (/[a-z]/.test(lastChar)) {
                if (this.onLetterCallback) {
                    this.onLetterCallback(lastChar);
                }
            } else {
                if (this.onErrorCallback) {
                    this.onErrorCallback('Please say a single letter.');
                }
            }
        };

        this.speechRecognition.onspeechend = () => this.speechRecognition.stop();
        
        this.speechRecognition.onstart = () => {
            if (this.onStartCallback) this.onStartCallback();
        };

        this.speechRecognition.onend = () => {
            if (this.onEndCallback) this.onEndCallback();
        };

        this.speechRecognition.onerror = (event) => {
             console.error('Speech recognition error', event.error);
             if (event.error !== 'no-speech' && this.onErrorCallback) {
                this.onErrorCallback('Mic error. Try typing.');
             }
        };

        return true;
    }

    startListening() {
        if (this.speechRecognition) {
            try {
                this.speechRecognition.start();
            } catch(e) {
                console.error("Mic already started", e);
            }
        }
    }

    stopListening() {
        if (this.speechRecognition) {
            this.speechRecognition.stop();
        }
    }

    setCallbacks({ onLetter, onError, onStart, onEnd }) {
        this.onLetterCallback = onLetter;
        this.onErrorCallback = onError;
        this.onStartCallback = onStart;
        this.onEndCallback = onEnd;
    }

    isSupported() {
        return this.speechRecognition !== null;
    }
}

