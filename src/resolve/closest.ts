const distance = (a: string, b: string): number => {
	let row = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const next = [i];
		for (let j = 1; j <= b.length; j++) {
			next[j] = Math.min((row[j] as number) + 1, (next[j - 1] as number) + 1, (row[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1));
		}
		row = next;
	}
	return row[b.length] as number;
};

const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

const withDirectories = (files: string[]): Set<string> => {
	const all = new Set<string>();
	for (const file of files) {
		const parts = file.split("/");
		for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join("/"));
	}
	return all;
};

export function closestPath(missing: string, files: string[]): string | null {
	const wanted = missing.replace(/\/+$/, "");
	const candidates = [...withDirectories(files)];
	const sameName = candidates.filter((c) => basename(c) === basename(wanted));
	if (sameName.length === 1) return sameName[0] as string;

	const limit = Math.min(3, Math.floor(wanted.length / 3));
	const scored = candidates.map((c) => ({ c, d: distance(wanted, c) })).filter((s) => s.d <= limit);
	const best = Math.min(...scored.map((s) => s.d));
	const winners = scored.filter((s) => s.d === best);
	return winners.length === 1 ? (winners[0] as { c: string }).c : null;
}
