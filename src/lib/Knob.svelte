<script>
	// Knob rotatif assignable. Glisser verticalement ou molette pour régler.
	let { value = 0, label = '', cc = 0, learning = false, onchange, onedit, onlearn } = $props();

	const MIN = 0;
	const MAX = 127;
	const A0 = -135; // angle du minimum
	const A1 = 135; // angle du maximum
	const R = 26;
	const C = 32;

	// angle mesuré depuis le haut (12 h), sens horaire positif
	function polar(angle, r = R) {
		const a = (angle * Math.PI) / 180;
		return [C + r * Math.sin(a), C - r * Math.cos(a)];
	}
	function arc(a0, a1, r = R) {
		const [x0, y0] = polar(a0, r);
		const [x1, y1] = polar(a1, r);
		const large = a1 - a0 > 180 ? 1 : 0;
		return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
	}

	let vAngle = $derived(A0 + ((value - MIN) / (MAX - MIN)) * (A1 - A0));
	let tip = $derived(polar(vAngle, R - 5));

	let dragging = false;
	let startY = 0;
	let startVal = 0;

	function emit(v) {
		const c = Math.max(MIN, Math.min(MAX, Math.round(v)));
		if (c !== value) onchange?.(c);
	}
	function down(e) {
		dragging = true;
		startY = e.clientY;
		startVal = value;
		e.currentTarget.setPointerCapture(e.pointerId);
	}
	function move(e) {
		if (!dragging) return;
		const dy = startY - e.clientY; // vers le haut = augmente
		emit(startVal + (dy / 150) * (MAX - MIN));
	}
	function up() {
		dragging = false;
	}
	function wheel(e) {
		e.preventDefault();
		emit(value + (e.deltaY < 0 ? 2 : -2));
	}
	function key(e) {
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
			e.preventDefault();
			emit(value + 1);
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
			e.preventDefault();
			emit(value - 1);
		}
	}
	const clampCC = (x) => Math.max(0, Math.min(127, parseInt(x) || 0));
</script>

<div class="k">
	<svg
		viewBox="0 0 64 64"
		class="dial"
		class:learning
		role="slider"
		tabindex="0"
		aria-label={label}
		aria-valuenow={value}
		aria-valuemin={MIN}
		aria-valuemax={MAX}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointerleave={up}
		onwheel={wheel}
		onkeydown={key}
	>
		<path d={arc(A0, A1)} class="track" />
		<path d={arc(A0, vAngle)} class="fill" />
		<line x1="32" y1="32" x2={tip[0]} y2={tip[1]} class="ind" />
		<circle cx="32" cy="32" r="3.5" class="hub" />
	</svg>

	<input
		class="lab"
		value={label}
		spellcheck="false"
		oninput={(e) => onedit?.({ label: e.currentTarget.value })}
	/>
	<div class="ccrow">
		<button
			class="learn"
			class:on={learning}
			onclick={() => onlearn?.()}
			title="MIDI-learn : capte le prochain CC entrant"
			aria-label="MIDI learn">L</button
		>
		<span class="cclab">CC</span>
		<input
			class="cc"
			type="number"
			min="0"
			max="127"
			value={cc}
			oninput={(e) => onedit?.({ cc: clampCC(e.currentTarget.value) })}
		/>
		<span class="v">{value}</span>
	</div>
</div>

<style>
	.k {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 92px;
	}
	.dial {
		width: 64px;
		height: 64px;
		cursor: ns-resize;
		touch-action: none;
		outline: none;
		border-radius: 50%;
	}
	.dial:focus-visible {
		box-shadow: 0 0 0 3px rgba(240, 168, 60, 0.4);
	}
	.track {
		fill: none;
		stroke: #34383f;
		stroke-width: 5;
		stroke-linecap: round;
	}
	.fill {
		fill: none;
		stroke: #f0a83c;
		stroke-width: 5;
		stroke-linecap: round;
		filter: drop-shadow(0 0 3px rgba(240, 168, 60, 0.55));
	}
	.dial.learning .fill {
		stroke: #f05c5c;
		filter: drop-shadow(0 0 4px rgba(240, 92, 92, 0.7));
	}
	.ind {
		stroke: #ece7d6;
		stroke-width: 2.5;
		stroke-linecap: round;
	}
	.hub {
		fill: #1a1c20;
		stroke: #4a4e56;
		stroke-width: 1.5;
	}
	.lab {
		width: 100%;
		text-align: center;
		background: transparent;
		border: none;
		border-bottom: 1px solid transparent;
		color: #cfd2d6;
		font: inherit;
		font-size: 12px;
		padding: 1px 0;
	}
	.lab:hover,
	.lab:focus {
		border-bottom-color: #4a4e56;
		outline: none;
	}
	.ccrow {
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: ui-monospace, monospace;
		font-size: 11px;
		color: #8a9088;
	}
	.learn {
		width: 16px;
		height: 16px;
		line-height: 1;
		padding: 0;
		border-radius: 4px;
		border: 1px solid #4a4e56;
		background: #202226;
		color: #8a9088;
		font-size: 10px;
		cursor: pointer;
	}
	.learn.on {
		background: #f05c5c;
		border-color: #f05c5c;
		color: #1a0d0d;
		animation: pulse 1s ease-in-out infinite;
	}
	.cc {
		width: 34px;
		background: #1a1c20;
		border: 1px solid #3a3e45;
		border-radius: 4px;
		color: #cfd2d6;
		font: inherit;
		font-size: 11px;
		text-align: center;
		-moz-appearance: textfield;
	}
	.cc::-webkit-outer-spin-button,
	.cc::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.v {
		min-width: 22px;
		text-align: right;
		color: #f0a83c;
	}
	@keyframes pulse {
		50% {
			opacity: 0.55;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.learn.on {
			animation: none;
		}
	}
</style>