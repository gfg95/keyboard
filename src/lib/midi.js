// src/lib/midi.js
// Constructeurs d'octets MIDI + décodage + utilitaires clavier.

export const MIDI = {
	NOTE_OFF: 0x80,
	NOTE_ON: 0x90,
	CONTROL_CHANGE: 0xb0,
	PITCH_BEND: 0xe0,
	ALL_NOTES_OFF: 123
};

const nib = (ch) => ch & 0x0f;
const b7 = (v) => Math.max(0, Math.min(127, v | 0));

/** [0x9n, note, vel] */
export const noteOnBytes = (ch, note, vel) => [MIDI.NOTE_ON | nib(ch), b7(note), b7(vel)];
/** [0x8n, note, 0] */
export const noteOffBytes = (ch, note) => [MIDI.NOTE_OFF | nib(ch), b7(note), 0];
/** [0xBn, cc, val] */
export const ccBytes = (ch, cc, val) => [MIDI.CONTROL_CHANGE | nib(ch), b7(cc), b7(val)];

/** Pitch bend 14 bits (0..16383, centre 8192) -> [0xEn, LSB, MSB] */
export function pitchBendBytes(ch, value14) {
	const v = Math.max(0, Math.min(16383, value14 | 0));
	return [MIDI.PITCH_BEND | nib(ch), v & 0x7f, (v >> 7) & 0x7f];
}

/** Décode un message entrant (utilisé pour le MIDI-learn). */
export function parseMidiMessage(bytes) {
	if (!bytes || bytes.length === 0) return { type: 'empty' };
	const status = bytes[0];
	if (status >= 0xf8) return { type: 'realtime', status };
	const command = status & 0xf0;
	const channel = status & 0x0f;
	if (command === MIDI.CONTROL_CHANGE) {
		return { type: 'cc', channel, controller: bytes[1], value: bytes[2] ?? 0 };
	}
	if (command === MIDI.NOTE_ON) {
		const vel = bytes[2] ?? 0;
		return { type: vel > 0 ? 'noteon' : 'noteoff', channel, note: bytes[1], velocity: vel };
	}
	if (command === MIDI.NOTE_OFF) {
		return { type: 'noteoff', channel, note: bytes[1], velocity: bytes[2] ?? 0 };
	}
	return { type: 'other', status };
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function noteName(note) {
	return NOTE_NAMES[note % 12] + (Math.floor(note / 12) - 1);
}

// Clavier d'ordinateur -> demi-tons (disposition « piano » standard).
export const KEY_SEMITONE = {
	a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
	k: 12, o: 13, l: 14, p: 15
};
// Table inverse pour afficher la touche sur chaque note.
export const SEMITONE_KEY = Object.fromEntries(
	Object.entries(KEY_SEMITONE).map(([k, s]) => [s, k.toUpperCase()])
);