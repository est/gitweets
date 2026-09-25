const TARGET_SIZE = 100 * 1024;

function updateFilename(filename, ext) {
	const base = filename.includes('.') ? filename.slice(0, filename.lastIndexOf('.')) : filename;
	return `${base}.${ext}`;
}

function makeStream(content) {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new Uint8Array(content));
			controller.close();
		}
	});
}

export async function compressImageBuffer(content, type, filename, env) {
	const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
	if (bytes.byteLength <= TARGET_SIZE && /^(image\/(jpeg|webp|avif))$/i.test(type)) {
		return { content: bytes.buffer, type, filename };
	}

	if (!env?.IMAGES) {
		console.log('[compress] IMAGES binding not available, skip server-side compress');
		return { content: bytes.buffer, type, filename };
	}

	const info = await env.IMAGES.input(makeStream(bytes)).info();
	let width = info.width;
	// console.log(`[compress] original: ${filename} ${width}x${info.height} ${(bytes.byteLength / 1024).toFixed(1)}KB`);

	let transformed = await env.IMAGES.input(makeStream(bytes))
		.transform({ width })
		.output({ format: 'image/avif' })
		.response();

	let resultBytes = new Uint8Array(await transformed.arrayBuffer());
	// console.log(`[compress] round 1: width=${width} -> ${(resultBytes.byteLength / 1024).toFixed(1)}KB`);

	let attempts = 0;
	const MAX_ATTEMPTS = 3;

	while (resultBytes.byteLength > TARGET_SIZE && attempts < MAX_ATTEMPTS) {
		attempts++;
		const ratio = Math.sqrt(TARGET_SIZE / resultBytes.byteLength);
		width = Math.max(1, Math.round(width * ratio));

		transformed = await env.IMAGES.input(makeStream(bytes))
			.transform({ width })
			.output({ format: 'image/avif' })
			.response();

		resultBytes = new Uint8Array(await transformed.arrayBuffer());
		// console.log(`[compress] round ${attempts + 1}: width=${width} -> ${(resultBytes.byteLength / 1024).toFixed(1)}KB`);
	}

	return {
		content: resultBytes.buffer,
		type: 'image/avif',
		filename: updateFilename(filename, 'avif')
	};
}

export async function compressImages(images, env) {
	const results = [];
	for (const img of images) {
		results.push(await compressImageBuffer(img.content, img.type, img.filename, env));
	}
	return results;
}
