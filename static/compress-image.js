let picaInstance = null;

async function loadPica() {
	if (!picaInstance) {
		const module = await import('https://unpkg.com/pica@8.0.0/dist/pica.min.js');
		picaInstance = module.default ? module.default() : pica();
	}
	return picaInstance;
}

export async function compressImage(file, targetSize = 100 * 1024) {
	const smallAndTargetFormat = file.size <= targetSize && /^(image\/(jpeg|webp|avif))$/.test(file.type);
	if (smallAndTargetFormat) return file;

	const img = new Image();
	img.loading = 'eager';
	img.src = URL.createObjectURL(file);
	try {
		await img.decode();
	} catch (e) {
		console.log('[compress] img.decode() failed:', e, 'source', file.name, file.size);
		URL.revokeObjectURL(img.src);
		return file;
	}

	let format = 'image/jpeg';
	const probe = document.createElement('canvas');
	probe.width = probe.height = 2;
	for (const type of ['image/avif', 'image/webp', 'image/jpeg']) {
		const b = await new Promise(r => probe.toBlob(r, type, 0.5));
		if (b && b.type === type) { format = type; break; }
	}
	console.log('[compress] format:', format, 'source:', file.name, file.size);

	let usePica = true, p = null;
	try { p = await loadPica(); } catch (e) { usePica = false; }

	const compress = async (w, h) => {
		const canvas = document.createElement('canvas');
		canvas.width = w; canvas.height = h;
		if (usePica && p) {
			await p.resize(img, canvas, { quality: 3, alpha: true, unsharpAmount: 80, unsharpRadius: 0.6, unsharpThreshold: 2 });
		} else {
			canvas.getContext('2d').drawImage(img, 0, 0, w, h);
		}
		return new Promise(resolve => canvas.toBlob(resolve, format, 0.85));
	};

	let width = Math.min(800, img.width);
	let height = Math.round(img.height * (width / img.width));

	let blob = await compress(width, height);
	console.log('[compress] round 1:', width, 'x', height, '->', blob?.size, 'bytes');

	if (blob && blob.size > targetSize) {
		const scale = Math.sqrt(targetSize / blob.size);
		width = Math.round(width * scale);
		height = Math.round(height * scale);
		blob = await compress(width, height);
		console.log('[compress] round 2:', width, 'x', height, '->', blob?.size, 'bytes');
	}

	URL.revokeObjectURL(img.src);
	return blob || file;
}
