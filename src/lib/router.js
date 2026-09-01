// src/lib/router.js
// Pont vers l'extension « Web MIDI Tab Router » via window.postMessage.
// Identique à celui du synthé : les deux apps doivent utiliser le MÊME contrat.

const OUT_TYPE = 'MIDI_OUT_TO_EXTENSION';

// ⚠️ Sens ENTRANT non documenté par l'extension. Sert ici uniquement au MIDI-learn.
// Doit correspondre EXACTEMENT à la valeur utilisée dans le synthé (router.js).
const IN_TYPE = 'MIDI_IN_FROM_EXTENSION';

/** Émet un message MIDI vers les autres onglets. @param {number[]} bytes */
export function sendMidi(bytes) {
	if (typeof window === 'undefined') return;
	window.postMessage({ type: OUT_TYPE, midiData: Array.from(bytes) }, '*');
}

/**
 * S'abonne aux messages MIDI entrants (utilisé pour le MIDI-learn).
 * @param {(bytes:number[]) => void} onBytes
 * @returns {() => void} désabonnement
 */
export function subscribeMidi(onBytes) {
	if (typeof window === 'undefined') return () => {};
	const handler = (event) => {
		const data = event.data;
		if (!data || typeof data !== 'object') return;
		if (data.type !== IN_TYPE || !Array.isArray(data.midiData)) return;
		onBytes(data.midiData);
	};
	window.addEventListener('message', handler);
	return () => window.removeEventListener('message', handler);
}