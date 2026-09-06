<script>
	import { onMount } from 'svelte';
	import Knob from '$lib/Knob.svelte';
	import { bus } from '$lib/bus.js';
	import {
		noteOnBytes,
		noteOffBytes,
		ccBytes,
		pitchBendBytes,
		parseMidiMessage,
		noteName,
		KEY_SEMITONE,
		SEMITONE_KEY,
		MIDI
	} from '$lib/midi.js';

	const STORAGE_KEY = 'midi-controller-knobs-v1';

	// Assignations par défaut : calquées sur les CC du synthé FM Tab Router.
	const DEFAULT_KNOBS = [
		{ id: 'k1', label: 'Volume', cc: 7, value: 100 },
		{ id: 'k2', label: 'Harmonicity', cc: 74, value: 46 },
		{ id: 'k3', label: 'FM Index', cc: 71, value: 50 },
		{ id: 'k4', label: 'Attack', cc: 73, value: 5 },
		{ id: 'k5', label: 'Decay', cc: 75, value: 30 },
		{ id: 'k6', label: 'Release', cc: 72, value: 40 },
		{ id: 'k7', label: 'Reverb', cc: 91, value: 20 },
		{ id: 'k8', label: 'Mod Wheel', cc: 1, value: 0 }
	];

	let channel = $state(0); // 0..15
	let octave = $state(0); // décalage en octaves (-3..+3)
	let velocity = $state(100);
	let knobs = $state(structuredClone(DEFAULT_KNOBS));
	let learningId = $state(null);
	let bend = $state(8192); // pitch bend courant
	let activeNotes = $state({});
	let flash = $state(false); // témoin d'activité MIDI

	let baseNote = $derived(60 + octave * 12);

	// --- Persistance des assignations ---
	function saveKnobs() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(knobs));
		} catch (_) {}
	}
	
	onMount(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) knobs = JSON.parse(raw);
		} catch (_) {}
		const off = bus.onMidi(handleIncoming);
		return off;
	});

	function blink() {
		flash = true;
		setTimeout(() => (flash = false), 90);
	}

	// --- Réception (MIDI-learn) ---
	function handleIncoming(bytes) {
		const msg = parseMidiMessage(bytes);
		if (msg.type !== 'cc') return;
		if (learningId) {
			const k = knobs.find((x) => x.id === learningId);
			if (k) {
				k.cc = msg.controller;
				learningId = null;
				saveKnobs();
			}
		}
	}

	// --- Knobs ---
	function onKnobChange(k, v) {
		k.value = v;
		bus.sendMidi(ccBytes(channel, k.cc, v));
		blink();
	}
	function onKnobEdit(k, patch) {
		Object.assign(k, patch);
		saveKnobs();
	}
	function toggleLearn(k) {
		learningId = learningId === k.id ? null : k.id;
	}
	function resetKnobs() {
		knobs = structuredClone(DEFAULT_KNOBS);
		learningId = null;
		saveKnobs();
		// pousse toutes les valeurs vers le synthé
		for (const k of knobs) bus.sendMidi(ccBytes(channel, k.cc, k.value));
	}
	function sendAll() {
		for (const k of knobs) bus.sendMidi(ccBytes(channel, k.cc, k.value));
		blink();
	}

	// --- Notes ---
	function press(note) {
		if (activeNotes[note]) return;
		activeNotes[note] = true;
		bus.sendMidi(noteOnBytes(channel, note, velocity));
		blink();
	}
	function release(note) {
		if (!activeNotes[note]) return;
		delete activeNotes[note];
		bus.sendMidi(noteOffBytes(channel, note));
	}
	function panic() {
		for (const n of Object.keys(activeNotes)) bus.sendMidi(noteOffBytes(channel, +n));
		bus.sendMidi(ccBytes(channel, MIDI.ALL_NOTES_OFF, 0));
		activeNotes = {};
	}
	function shiftOctave(d) {
		panic();
		octave = Math.max(-3, Math.min(3, octave + d));
	}

	// --- Pitch bend (revient au centre au relâchement) ---
	function onBend(v) {
		bend = v;
		bus.sendMidi(pitchBendBytes(channel, v));
	}
	function releaseBend() {
		bend = 8192;
		bus.sendMidi(pitchBendBytes(channel, 8192));
	}

	// --- Clavier d'ordinateur ---
	const heldKeys = new Map(); // touche -> note (pour libérer la bonne note même après changement d'octave)
	function isTyping(e) {
		const t = e.target;
		return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
	}
	function onKeydown(e) {
		if (isTyping(e)) return;
		const key = e.key.toLowerCase();
		if (key === 'arrowleft') return shiftOctave(-1);
		if (key === 'arrowright') return shiftOctave(1);
		if (e.repeat || heldKeys.has(key)) return;
		const semi = KEY_SEMITONE[key];
		if (semi === undefined) return;
		const note = baseNote + semi;
		heldKeys.set(key, note);
		press(note);
	}
	function onKeyup(e) {
		const key = e.key.toLowerCase();
		if (!heldKeys.has(key)) return;
		release(heldKeys.get(key));
		heldKeys.delete(key);
	}

	// --- Géométrie du clavier à l'écran (2 octaves depuis baseNote) ---
	const WHITE_SEMI = [0, 2, 4, 5, 7, 9, 11];
	const BLACK_AFTER = { 0: 1, 1: 3, 3: 6, 4: 8, 5: 10 };
	function buildKeys(base) {
		const white = [];
		const black = [];
		for (let o = 0; o < 2; o++) {
			WHITE_SEMI.forEach((s, wi) => {
				const idx = o * 7 + wi;
				white.push({ note: base + o * 12 + s, idx });
				if (BLACK_AFTER[wi] !== undefined) black.push({ note: base + o * 12 + BLACK_AFTER[wi], idx });
			});
		}
		return { white, black };
	}
	let keys = $derived(buildKeys(baseNote));
	const keyW = 100 / 14;
	function hint(note) {
		return SEMITONE_KEY[note - baseNote] ?? '';
	}
</script>

<svelte:window
	on:keydown={onKeydown}
	on:keyup={onKeyup}
	on:pointerup={() => Object.keys(activeNotes).forEach((n) => release(+n))}
/>

<main>
	<div class="panel">
		<header>
			<div class="brand">
				<span class="dot" class:flash></span>
				<h1>MIDI Controller</h1>
				<span class="sub">clavier + knobs assignables · émet vers les autres onglets</span>
			</div>
			<div class="ctrls">
				<label>Canal
					<select bind:value={channel}>
						{#each Array(16) as _, i}
							<option value={i}>{i + 1}</option>
						{/each}
					</select>
				</label>
				<div class="oct">
					<button onclick={() => shiftOctave(-1)} aria-label="Octave -">−</button>
					<span>Oct {octave >= 0 ? '+' : ''}{octave}</span>
					<button onclick={() => shiftOctave(1)} aria-label="Octave +">+</button>
				</div>
				<button class="ghost" onclick={sendAll}>Tout envoyer</button>
				<button class="ghost" onclick={panic}>Panic</button>
			</div>
		</header>

		<!-- Banc de knobs assignables -->
		<section class="knobs">
			{#each knobs as k (k.id)}
				<Knob
					value={k.value}
					label={k.label}
					cc={k.cc}
					learning={learningId === k.id}
					onchange={(v) => onKnobChange(k, v)}
					onedit={(patch) => onKnobEdit(k, patch)}
					onlearn={() => toggleLearn(k)}
				/>
			{/each}
		</section>

		<div class="assignbar">
			<span>
				{#if learningId}
					<b class="learn">MIDI-learn actif</b> — tourne un contrôleur externe pour l'assigner, ou clique « L » à nouveau pour annuler.
				{:else}
					Édite le n° de CC sous chaque knob, ou clique <b>L</b> puis envoie un CC pour l'assigner.
				{/if}
			</span>
			<button class="ghost sm" onclick={resetKnobs}>Réinitialiser</button>
		</div>

		<!-- Pitch bend + clavier -->
		<div class="play">
			<div class="wheel">
				<input
					class="bend"
					type="range"
					min="0"
					max="16383"
					value={bend}
					oninput={(e) => onBend(+e.currentTarget.value)}
					onpointerup={releaseBend}
					onkeyup={releaseBend}
					aria-label="Pitch bend"
				/>
				<span>Bend</span>
			</div>

			<div class="kbd">
				{#each keys.white as k}
					<button
						class="wkey"
						class:active={activeNotes[k.note]}
						style="left:{k.idx * keyW}%; width:{keyW}%"
						onpointerdown={() => press(k.note)}
						onpointerup={() => release(k.note)}
						onpointerenter={(e) => e.buttons && press(k.note)}
						onpointerleave={(e) => e.buttons && release(k.note)}
						aria-label={noteName(k.note)}
					>
						{#if hint(k.note)}<span class="hint">{hint(k.note)}</span>{/if}
					</button>
				{/each}
				{#each keys.black as k}
					<button
						class="bkey"
						class:active={activeNotes[k.note]}
						style="left:calc({(k.idx + 1) * keyW}% - {keyW * 0.32}%); width:{keyW * 0.64}%"
						onpointerdown={() => press(k.note)}
						onpointerup={() => release(k.note)}
						aria-label={noteName(k.note)}
					>
						{#if hint(k.note)}<span class="hint b">{hint(k.note)}</span>{/if}
					</button>
				{/each}
			</div>
		</div>

		<footer>
			<label class="vel">Vélocité
				<input type="range" min="1" max="127" bind:value={velocity} />
				<span>{velocity}</span>
			</label>
			<span class="tip">Joue avec la souris ou les touches A W S E D F… · ← → change d'octave</span>
		</footer>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #131417;
		color: #cfd2d6;
		font-family: 'Inter', system-ui, sans-serif;
	}
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 28px 16px;
	}
	.panel {
		width: min(820px, 100%);
		background: linear-gradient(#212429, #191b1f);
		border: 1px solid #30343b;
		border-radius: 14px;
		box-shadow: 0 1px 0 #3b3f47 inset, 0 18px 50px rgba(0, 0, 0, 0.55);
		padding: 22px;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 20px;
	}
	.brand {
		display: flex;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
	}
	.brand h1 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: #eceef1;
	}
	.brand .sub {
		font-size: 12.5px;
		color: #838a91;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #4a4e56;
		align-self: center;
		transition: background 0.09s, box-shadow 0.09s;
	}
	.dot.flash {
		background: #f0a83c;
		box-shadow: 0 0 10px #f0a83caa;
	}

	.ctrls {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		font-size: 12px;
		color: #838a91;
	}
	label {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	select {
		background: #17191d;
		color: #cfd2d6;
		border: 1px solid #3a3e45;
		border-radius: 6px;
		padding: 4px 6px;
		font: inherit;
		font-size: 12px;
	}
	.oct {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #17191d;
		border: 1px solid #3a3e45;
		border-radius: 6px;
		padding: 3px 8px;
		font-family: ui-monospace, monospace;
		color: #cfd2d6;
	}
	.oct button,
	.ghost {
		background: #262a30;
		color: #cfd2d6;
		border: 1px solid #3a3e45;
		border-radius: 6px;
		cursor: pointer;
		font: inherit;
	}
	.oct button {
		width: 22px;
		height: 22px;
		padding: 0;
		font-size: 15px;
		line-height: 1;
	}
	.ghost {
		padding: 6px 12px;
		font-size: 12px;
	}
	.ghost:hover,
	.oct button:hover {
		border-color: #f0a83c;
		color: #f0a83c;
	}
	.ghost.sm {
		padding: 3px 10px;
	}

	.knobs {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
		gap: 18px 10px;
		justify-items: center;
		padding: 8px 0 14px;
	}

	.assignbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		font-size: 12px;
		color: #838a91;
		border-top: 1px solid #2a2e34;
		border-bottom: 1px solid #2a2e34;
		padding: 10px 0;
		margin-bottom: 18px;
	}
	.assignbar b {
		color: #cfd2d6;
	}
	.assignbar .learn {
		color: #f05c5c;
	}

	.play {
		display: flex;
		gap: 14px;
		align-items: stretch;
	}
	.wheel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		color: #838a91;
	}
	.bend {
		writing-mode: vertical-lr;
		direction: rtl;
		width: 26px;
		height: 130px;
		accent-color: #f0a83c;
	}

	.kbd {
		position: relative;
		flex: 1;
		height: 150px;
		border-radius: 8px;
		background: #17191d;
		border: 1px solid #30343b;
		overflow: hidden;
		touch-action: none;
	}
	.wkey {
		position: absolute;
		top: 0;
		bottom: 0;
		background: linear-gradient(#eef0f2, #d7dade);
		border: 1px solid #24262b;
		border-radius: 0 0 5px 5px;
		padding: 0;
		cursor: pointer;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 8px;
	}
	.wkey.active {
		background: linear-gradient(#ffd79a, #f0a83c);
	}
	.bkey {
		position: absolute;
		top: 0;
		height: 62%;
		background: linear-gradient(#2f333a, #17191d);
		border: 1px solid #0b0c0e;
		border-radius: 0 0 4px 4px;
		z-index: 2;
		cursor: pointer;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 6px;
	}
	.bkey.active {
		background: linear-gradient(#c07d1f, #f0a83c);
	}
	.hint {
		font-size: 10px;
		color: #9aa0a6;
		font-family: ui-monospace, monospace;
		pointer-events: none;
	}
	.hint.b {
		color: #cfd2d6;
	}

	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		margin-top: 16px;
		font-size: 12px;
		color: #838a91;
	}
	.vel {
		gap: 8px;
	}
	.vel input {
		width: 130px;
		accent-color: #f0a83c;
	}
	.vel span {
		font-family: ui-monospace, monospace;
		color: #f0a83c;
		min-width: 26px;
	}
	.tip {
		color: #6b7178;
	}

	@media (prefers-reduced-motion: reduce) {
		.dot {
			transition: none;
		}
	}
</style>