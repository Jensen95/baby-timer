function hslToRgb(h, s, l) {
	s /= 100;
	l /= 100;
	const a = s * Math.min(l, 1 - l);
	const f = (n) => {
		const k = (n + h / 30) % 12;
		return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
	};
	return [f(0), f(8), f(4)];
}
function luminance(r, g, b) {
	const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function ratio(c1, c2) {
	const L1 = luminance(...hslToRgb(...c1));
	const L2 = luminance(...hslToRgb(...c2));
	const hi = Math.max(L1, L2),
		lo = Math.min(L1, L2);
	return (hi + 0.05) / (lo + 0.05);
}

// Token sets per theme. Edit these to match themes.css and re-run.
const themes = {
	light: {
		bg: [340, 40, 99],
		surface: [0, 0, 100],
		text: [330, 15, 16],
		'text-2': [330, 8, 42],
		'on-color': [0, 0, 100],
		brand: [340, 70, 62],
		'on-brand': [0, 0, 100],
		'feed-fill': [340, 75, 94],
		'feed-ink': [340, 55, 38],
		'feed-solid': [340, 70, 62],
		'sleep-fill': [245, 70, 94],
		'sleep-ink': [245, 45, 45],
		'sleep-solid': [245, 60, 64],
		'pump-fill': [45, 85, 90],
		'pump-ink': [38, 70, 34],
		'pump-solid': [43, 80, 58],
		'diaper-fill': [168, 60, 91],
		'diaper-ink': [172, 60, 28],
		'diaper-solid': [172, 55, 45],
		success: [152, 50, 42],
		warning: [36, 80, 44],
		danger: [4, 70, 52],
		info: [210, 65, 50]
	},
	dark: {
		bg: [265, 18, 9],
		surface: [265, 16, 13],
		text: [280, 12, 92],
		'text-2': [280, 8, 70],
		'on-color': [265, 20, 10],
		brand: [340, 65, 68],
		'on-brand': [340, 20, 8],
		'feed-fill': [340, 35, 20],
		'feed-ink': [340, 70, 80],
		'feed-solid': [340, 60, 64],
		'sleep-fill': [245, 35, 22],
		'sleep-ink': [245, 65, 82],
		'sleep-solid': [245, 55, 70],
		'pump-fill': [43, 35, 20],
		'pump-ink': [45, 80, 75],
		'pump-solid': [43, 70, 62],
		'diaper-fill': [172, 30, 18],
		'diaper-ink': [168, 60, 72],
		'diaper-solid': [172, 50, 56],
		success: [152, 50, 64],
		warning: [40, 80, 66],
		danger: [4, 75, 70],
		info: [210, 65, 70]
	},
	night: {
		bg: [20, 30, 4],
		surface: [22, 26, 7],
		text: [30, 30, 70],
		'text-2': [30, 22, 52],
		'on-color': [22, 30, 6],
		brand: [20, 50, 50],
		'on-brand': [22, 40, 6],
		'feed-fill': [12, 35, 14],
		'feed-ink': [14, 50, 60],
		'feed-solid': [13, 45, 48],
		'sleep-fill': [30, 30, 13],
		'sleep-ink': [32, 42, 58],
		'sleep-solid': [31, 38, 46],
		'pump-fill': [40, 38, 13],
		'pump-ink': [42, 55, 58],
		'pump-solid': [41, 48, 46],
		'diaper-fill': [48, 32, 12],
		'diaper-ink': [46, 45, 56],
		'diaper-solid': [47, 40, 44],
		success: [80, 35, 50],
		warning: [38, 55, 54],
		danger: [10, 55, 54],
		info: [28, 45, 56]
	},
	grey: {
		bg: [210, 29, 97],
		surface: [0, 0, 100],
		text: [215, 14, 16],
		'text-2': [212, 12, 42],
		'on-color': [0, 0, 100],
		brand: [340, 58, 62],
		'on-brand': [0, 0, 100],
		'feed-fill': [346, 72, 94],
		'feed-ink': [346, 64, 40],
		'feed-solid': [346, 66, 58],
		'sleep-fill': [245, 60, 95],
		'sleep-ink': [245, 55, 46],
		'sleep-solid': [245, 58, 62],
		'pump-fill': [185, 56, 92],
		'pump-ink': [187, 70, 30],
		'pump-solid': [186, 64, 42],
		'diaper-fill': [42, 88, 90],
		'diaper-ink': [33, 78, 36],
		'diaper-solid': [38, 84, 52],
		success: [137, 55, 36],
		warning: [35, 84, 38],
		danger: [356, 64, 49],
		info: [212, 78, 46]
	}
};

// pairs: [fg, bg, requiredRatio, label]
const pairs = [
	['text', 'bg', 4.5],
	['text', 'surface', 4.5],
	['text-2', 'bg', 4.5],
	['text-2', 'surface', 4.5],
	['feed-ink', 'feed-fill', 4.5],
	['sleep-ink', 'sleep-fill', 4.5],
	['pump-ink', 'pump-fill', 4.5],
	['diaper-ink', 'diaper-fill', 4.5],
	['feed-ink', 'surface', 4.5],
	['sleep-ink', 'surface', 4.5],
	['pump-ink', 'surface', 4.5],
	['diaper-ink', 'surface', 4.5],
	['on-brand', 'brand', 4.5],
	['brand', 'bg', 3.0],
	['brand', 'surface', 3.0],
	['success', 'surface', 3.0],
	['warning', 'surface', 3.0],
	['danger', 'surface', 3.0],
	['info', 'surface', 3.0],
	['on-color', 'feed-solid', 4.5],
	['on-color', 'sleep-solid', 4.5],
	['on-color', 'pump-solid', 4.5],
	['on-color', 'diaper-solid', 4.5]
];

let anyFail = false;
for (const [theme, tokens] of Object.entries(themes)) {
	console.log(`\n=== ${theme.toUpperCase()} THEME ===`);
	console.log('PAIR'.padEnd(34) + 'RATIO'.padStart(7) + 'REQ'.padStart(6) + '  RESULT');
	for (const [fg, bg, req] of pairs) {
		const r = ratio(tokens[fg], tokens[bg]);
		const pass = r >= req;
		if (!pass) anyFail = true;
		const label = `--${fg} on --${bg}`;
		console.log(
			label.padEnd(34) +
				r.toFixed(2).padStart(7) +
				`${req}`.padStart(6) +
				`  ${pass ? 'PASS' : 'FAIL'}`
		);
	}
}
console.log(`\n${anyFail ? 'SOME PAIRS FAIL' : 'ALL PAIRS PASS'}`);
