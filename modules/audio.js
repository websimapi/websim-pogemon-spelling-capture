const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const soundCache = {};

export async function playSound(url) {
    try {
        let buffer;
        if (soundCache[url]) {
            buffer = soundCache[url];
        } else {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            buffer = await audioContext.decodeAudioData(arrayBuffer);
            soundCache[url] = buffer;
        }
        
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
    } catch (error) {
        console.error(`Error playing sound ${url}:`, error);
    }
}

export function speak(text) {
    if (!text || typeof window.speechSynthesis === 'undefined') {
        console.warn('Speech synthesis not supported or no text to speak.');
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
}

export function cancelSpeech() {
    if (typeof window.speechSynthesis !== 'undefined') {
        window.speechSynthesis.cancel();
    }
}

export { audioContext };

