import type { StarredRepo } from './github';

export const BOOKMARKS_DATA_SOURCE_ID = '2a803953-a8af-80bf-a145-000b8cf4f5e0';

export interface Bookmark {
	pageId: string;
	url: string;
}

function headers(notionKey: string) {
	return {
		Authorization: `Bearer ${notionKey}`,
		'Notion-Version': '2026-03-11',
		'Content-Type': 'application/json'
	};
}

/** All Github-tagged rows in the Bookmarks DB (paginated). Rows without a URL are skipped. */
export async function fetchGithubBookmarks(notionKey: string): Promise<Bookmark[]> {
	const bookmarks: Bookmark[] = [];
	let cursor: string | null = null;
	do {
		const res: Response = await fetch(
			`https://api.notion.com/v1/data_sources/${BOOKMARKS_DATA_SOURCE_ID}/query`,
			{
				method: 'POST',
				headers: headers(notionKey),
				body: JSON.stringify({
					filter: { property: 'Tags', multi_select: { contains: 'Github' } },
					...(cursor ? { start_cursor: cursor } : {})
				})
			}
		);
		if (!res.ok) throw new Error(`Notion query ${res.status}: ${await res.text()}`);
		const data = (await res.json()) as {
			results: Array<{ id: string; properties: { URL?: { url: string | null } } }>;
			has_more: boolean;
			next_cursor: string | null;
		};
		for (const row of data.results) {
			const url = row.properties.URL?.url;
			if (url) bookmarks.push({ pageId: row.id, url });
		}
		cursor = data.has_more ? data.next_cursor : null;
	} while (cursor);
	return bookmarks;
}

/**
 * Field mapping verified against existing Github-tagged bookmark rows (2026-07-07):
 * Description (the TITLE property) = repo description, Title (rich_text) =
 * "owner/repo: description", URL = html_url, Tags = ["Github"].
 * Repos with no description fall back to fullName for both text fields.
 */
export async function createBookmark(notionKey: string, repo: StarredRepo): Promise<void> {
	const res = await fetch('https://api.notion.com/v1/pages', {
		method: 'POST',
		headers: headers(notionKey),
		body: JSON.stringify({
			parent: { type: 'data_source_id', data_source_id: BOOKMARKS_DATA_SOURCE_ID },
			properties: {
				Description: { title: [{ text: { content: repo.description ?? repo.fullName } }] },
				Title: {
					rich_text: [
						{
							text: {
								content: repo.description
									? `${repo.fullName}: ${repo.description}`
									: repo.fullName
							}
						}
					]
				},
				URL: { url: repo.htmlUrl },
				Tags: { multi_select: [{ name: 'Github' }] }
			}
		})
	});
	if (!res.ok) throw new Error(`Notion create ${res.status}: ${await res.text()}`);
}
