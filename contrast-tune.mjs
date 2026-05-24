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
	return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
}

const WHITE = [0, 0, 100];

// ---- LIGHT ----
console.log('LIGHT pump-ink on pump-fill (fill 45,85,90)');
for (const l of [34, 32, 31, 30])
	console.log(
		`  ink l=${l}:`,
		ratio([38, 70, l], [45, 85, 90]),
		'| on surface:',
		ratio([38, 70, l], WHITE)
	);

console.log('LIGHT on-brand(white) on brand (340,70,x)');
for (const l of [62, 58, 56, 54, 52, 50])
	console.log(
		`  brand l=${l}:`,
		ratio(WHITE, [340, 70, l]),
		'| brand on bg(340,40,99):',
		ratio([340, 70, l], [340, 40, 99])
	);

console.log('LIGHT white on solids (need 4.5) — current solids');
console.log('  feed-solid 340,70,62:', ratio(WHITE, [340, 70, 62]));
console.log('  sleep-solid 245,60,64:', ratio(WHITE, [245, 60, 64]));
console.log('  pump-solid 43,80,58:', ratio(WHITE, [43, 80, 58]));
console.log('  diaper-solid 172,55,45:', ratio(WHITE, [172, 55, 45]));
// To get white to 4.5 on these solids would require very dark solids, losing identity.
// Alternative: light/grey on-color stays white BUT solids used as chip bg need dark enough.
console.log('LIGHT darken solids for white 4.5:');
for (const l of [50, 48, 46, 44]) console.log(`  feed 340,70,l=${l}:`, ratio(WHITE, [340, 70, l]));
for (const l of [52, 50, 48]) console.log(`  sleep 245,60,l=${l}:`, ratio(WHITE, [245, 60, l]));
for (const l of [40, 38, 36, 34, 32])
	console.log(`  pump 43,80,l=${l}:`, ratio(WHITE, [43, 80, l]));
for (const l of [40, 38, 36]) console.log(`  diaper 172,55,l=${l}:`, ratio(WHITE, [172, 55, l]));

// ---- NIGHT ----
console.log('\nNIGHT on-color(22,30,6) on feed-solid (13,45,x)');
for (const l of [48, 50, 52, 54])
	console.log(`  feed-solid l=${l}:`, ratio([22, 30, 6], [13, 45, l]));

// ---- GREY ----
console.log('\nGREY diaper-ink on diaper-fill (42,88,90)');
for (const l of [36, 34, 33, 32])
	console.log(
		`  ink 33,78,l=${l}:`,
		ratio([33, 78, l], [42, 88, 90]),
		'| on surface:',
		ratio([33, 78, l], WHITE)
	);

console.log('GREY on-brand(white) on brand (340,58,x)');
for (const l of [62, 56, 54, 52, 50])
	console.log(
		`  brand l=${l}:`,
		ratio(WHITE, [340, 58, l]),
		'| brand on bg(210,29,97):',
		ratio([340, 58, l], [210, 29, 97])
	);

console.log('GREY white on solids (need 4.5)');
console.log('  feed-solid 346,66,58:', ratio(WHITE, [346, 66, 58]));
console.log('  sleep-solid 245,58,62:', ratio(WHITE, [245, 58, 62]));
console.log('  pump-solid 186,64,42:', ratio(WHITE, [186, 64, 42]));
console.log('  diaper-solid 38,84,52:', ratio(WHITE, [38, 84, 52]));
for (const l of [50, 48, 46]) console.log(`  feed 346,66,l=${l}:`, ratio(WHITE, [346, 66, l]));
for (const l of [40, 38, 36, 34]) console.log(`  pump 186,64,l=${l}:`, ratio(WHITE, [186, 64, l]));
for (const l of [40, 38, 36, 34, 32])
	console.log(`  diaper 38,84,l=${l}:`, ratio(WHITE, [38, 84, l]));
