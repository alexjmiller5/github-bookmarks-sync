import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGithubBookmarks, createBookmark, BOOKMARKS_DATA_SOURCE_ID } from './notion';

function jsonResponse(body: unknown) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

const notionRow = (id: string, url: string | null) => ({
	id,
	properties: { URL: { type: 'url', url } }
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('fetchGithubBookmarks', () => {
	it('queries the Bookmarks data source filtered to Tags contains Github', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [], has_more: false }));
		vi.stubGlobal('fetch', fetchMock);

		await fetchGithubBookmarks('key');
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(`https://api.notion.com/v1/data_sources/${BOOKMARKS_DATA_SOURCE_ID}/query`);
		expect(init.method).toBe('POST');
		expect(init.headers['Authorization']).toBe('Bearer key');
		expect(init.headers['Notion-Version']).toBe('2026-03-11');
		const body = JSON.parse(init.body);
		expect(body.filter).toEqual({ property: 'Tags', multi_select: { contains: 'Github' } });
	});

	it('returns pageId + url, skipping rows with no URL', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse({
					results: [notionRow('p1', 'https://github.com/a/b'), notionRow('p2', null)],
					has_more: false
				})
			)
		);
		const bookmarks = await fetchGithubBookmarks('key');
		expect(bookmarks).toEqual([{ pageId: 'p1', url: 'https://github.com/a/b' }]);
	});

	it('paginates with start_cursor until has_more is false', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					results: [notionRow('p1', 'https://github.com/a/b')],
					has_more: true,
					next_cursor: 'cur2'
				})
			)
			.mockResolvedValueOnce(
				jsonResponse({
					results: [notionRow('p2', 'https://github.com/c/d')],
					has_more: false,
					next_cursor: null
				})
			);
		vi.stubGlobal('fetch', fetchMock);

		const bookmarks = await fetchGithubBookmarks('key');
		expect(bookmarks.map((b) => b.pageId)).toEqual(['p1', 'p2']);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(JSON.parse(fetchMock.mock.calls[1][1].body).start_cursor).toBe('cur2');
	});

	it('throws on a non-2xx response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 403 })));
		await expect(fetchGithubBookmarks('key')).rejects.toThrow(/403/);
	});
});

describe('createBookmark', () => {
	// Field mapping verified against existing Github-tagged rows (2026-07-07):
	// Description (title) = repo description; Title (rich_text) = "owner/repo: description";
	// URL = html_url; Tags = ["Github"].
	it('creates a page matching the existing bookmark convention', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'new-page' }));
		vi.stubGlobal('fetch', fetchMock);

		await createBookmark('key', {
			fullName: 'owner/repo',
			description: 'A fine repo.',
			htmlUrl: 'https://github.com/owner/repo'
		});

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.notion.com/v1/pages');
		expect(init.method).toBe('POST');
		expect(init.headers['Notion-Version']).toBe('2026-03-11');
		const body = JSON.parse(init.body);
		expect(body.parent).toEqual({
			type: 'data_source_id',
			data_source_id: BOOKMARKS_DATA_SOURCE_ID
		});
		expect(body.properties).toEqual({
			Description: { title: [{ text: { content: 'A fine repo.' } }] },
			Title: { rich_text: [{ text: { content: 'owner/repo: A fine repo.' } }] },
			URL: { url: 'https://github.com/owner/repo' },
			Tags: { multi_select: [{ name: 'Github' }] }
		});
	});

	it('falls back to the repo fullName when description is null', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'new-page' }));
		vi.stubGlobal('fetch', fetchMock);

		await createBookmark('key', {
			fullName: 'owner/repo',
			description: null,
			htmlUrl: 'https://github.com/owner/repo'
		});

		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.properties.Description).toEqual({ title: [{ text: { content: 'owner/repo' } }] });
		expect(body.properties.Title).toEqual({ rich_text: [{ text: { content: 'owner/repo' } }] });
	});

	it('throws on a non-2xx response (no silent write failures)', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }))
		);
		await expect(
			createBookmark('key', {
				fullName: 'owner/repo',
				description: null,
				htmlUrl: 'https://github.com/owner/repo'
			})
		).rejects.toThrow(/429/);
	});
});
