import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchStarredRepos } from './github';

const ghRepo = (n: number) => ({
	full_name: `owner/repo${n}`,
	description: n % 2 ? `desc ${n}` : null,
	html_url: `https://github.com/owner/repo${n}`
});

function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json', ...headers }
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('fetchStarredRepos', () => {
	it('fetches a single page and maps fields', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([ghRepo(1)]));
		vi.stubGlobal('fetch', fetchMock);

		const repos = await fetchStarredRepos('tok');
		expect(repos).toEqual([
			{ fullName: 'owner/repo1', description: 'desc 1', htmlUrl: 'https://github.com/owner/repo1' }
		]);
	});

	it('requests /user/starred with per_page=100 and the right headers', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
		vi.stubGlobal('fetch', fetchMock);

		await fetchStarredRepos('tok');
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.github.com/user/starred?per_page=100');
		expect(init.headers['Authorization']).toBe('Bearer tok');
		expect(init.headers['Accept']).toBe('application/vnd.github+json');
	});

	it('follows Link header pagination until there is no rel="next"', async () => {
		const page2Url = 'https://api.github.com/user/starred?per_page=100&page=2';
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse([ghRepo(1)], {
					Link: `<${page2Url}>; rel="next", <${page2Url}>; rel="last"`
				})
			)
			.mockResolvedValueOnce(jsonResponse([ghRepo(2)]));
		vi.stubGlobal('fetch', fetchMock);

		const repos = await fetchStarredRepos('tok');
		expect(repos.map((r) => r.fullName)).toEqual(['owner/repo1', 'owner/repo2']);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[1][0]).toBe(page2Url);
	});

	it('throws on a non-2xx response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('bad credentials', { status: 401 }))
		);
		await expect(fetchStarredRepos('tok')).rejects.toThrow(/401/);
	});
});
