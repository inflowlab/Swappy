export type HttpError = {
	status: number
	message: string
	bodyText?: string
}

export async function getJson<T> (url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		...init,
		method: 'GET',
		headers: {
			accept: 'application/json',
			...(init?.headers ?? {}),
		},
		cache: 'no-store',
	})

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
	const res = await fetch(url, {
		...init,
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			...(init?.headers ?? {}),
		},
		body: JSON.stringify(body),
		cache: 'no-store',
	})

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


