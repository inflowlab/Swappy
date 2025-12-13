export type HttpError = {
	status: number
	message: string
	bodyText?: string
}

function withTimeout (init: RequestInit | undefined, timeoutMs = 10_000) {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
	const signal = init?.signal

	return {
		init: {
			...init,
			signal: signal ?? controller.signal,
		},
		clear: () => clearTimeout(timeoutId),
	}
}

export async function getJson<T> (url: string, init?: RequestInit): Promise<T> {
	const wrapped = withTimeout(init)
	const res = await fetch(url, {
		...wrapped.init,
		method: 'GET',
		headers: {
			accept: 'application/json',
			...(init?.headers ?? {}),
		},
		cache: 'no-store',
	}).finally(wrapped.clear)

	if (!res.ok) {
		let bodyText: string | undefined
		try {
			bodyText = await res.text()
		} catch {}
		const err: HttpError = {
			status: res.status,
			message: `HTTP ${res.status} for GET ${url}`,
			bodyText,
		}
		throw err
	}

	return (await res.json()) as T
}

export async function postJson<TResponse> (
	url: string,
	body: unknown,
	init?: RequestInit,
): Promise<TResponse> {
	const wrapped = withTimeout(init)
	const res = await fetch(url, {
		...wrapped.init,
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			...(init?.headers ?? {}),
		},
		body: JSON.stringify(body),
		cache: 'no-store',
	}).finally(wrapped.clear)

	if (!res.ok) {
		let bodyText: string | undefined
		try {
			bodyText = await res.text()
		} catch {}
		const err: HttpError = {
			status: res.status,
			message: `HTTP ${res.status} for POST ${url}`,
			bodyText,
		}
		throw err
	}

	return (await res.json()) as TResponse
}


