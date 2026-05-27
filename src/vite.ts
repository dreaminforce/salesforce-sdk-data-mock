import path from "node:path";
import { promises as fs } from "node:fs";
import {
	getSalesforceMockDefaultFixtures,
	type SalesforceMockRecord,
} from "./index.js";

type MiddlewareRequest = {
	method?: string;
	url?: string;
};

type MiddlewareResponse = {
	statusCode: number;
	setHeader(name: string, value: string): void;
	end(body?: string): void;
};

type ViteLikeServer = {
	config: {
		root: string;
	};
	middlewares: {
		use(
			handler: (
				req: MiddlewareRequest,
				res: MiddlewareResponse,
				next: () => void,
			) => void | Promise<void>,
		): void;
	};
};

type ViteLikePlugin = {
	name: string;
	apply: "serve";
	configureServer(server: ViteLikeServer): void;
};

export type SalesforceMockDataPluginOptions = {
	dataDir?: string;
	pagePath?: string;
	apiBase?: string;
};

const DEFAULT_DATA_DIR = "mock-data";
const DEFAULT_PAGE_PATH = "/mock-data";
const DEFAULT_API_BASE = "/__salesforce_sdk_data_mock__";

export function salesforceMockDataPlugin(
	options: SalesforceMockDataPluginOptions = {},
): ViteLikePlugin {
	const pagePath = normalizeRoute(options.pagePath ?? DEFAULT_PAGE_PATH);
	const apiBase = normalizeRoute(options.apiBase ?? DEFAULT_API_BASE);

	return {
		name: "salesforce-sdk-data-mock",
		apply: "serve",
		configureServer(server) {
			const dataDir = path.resolve(server.config.root, options.dataDir ?? DEFAULT_DATA_DIR);

			server.middlewares.use(async (req, res, next) => {
				const requestUrl = new URL(req.url ?? "/", "http://localhost");
				const pathname = decodeURIComponent(requestUrl.pathname);
				const method = req.method ?? "GET";

				try {
					if (method === "GET" && pathname === pagePath) {
						sendHtml(res, renderMockDataPage(apiBase));
						return;
					}

					if (!pathname.startsWith(`${apiBase}/`) && pathname !== apiBase) {
						next();
						return;
					}

					await handleApiRequest({ req, res, pathname, method, apiBase, dataDir });
				} catch (error) {
					sendJson(res, 500, {
						error:
							error instanceof Error
								? error.message
								: "Salesforce mock data request failed.",
					});
				}
			});
		},
	};
}

async function handleApiRequest({
	req,
	res,
	pathname,
	method,
	apiBase,
	dataDir,
}: {
	req: MiddlewareRequest;
	res: MiddlewareResponse;
	pathname: string;
	method: string;
	apiBase: string;
	dataDir: string;
}): Promise<void> {
	if (method === "GET" && pathname === `${apiBase}/fixtures`) {
		sendJson(res, 200, {
			fixtures: await readCsvFixtureMap(dataDir),
		});
		return;
	}

	if (method === "GET" && pathname === `${apiBase}/objects`) {
		const defaults = getSalesforceMockDefaultFixtures();
		const csvFixtures = await readCsvFixtureMap(dataDir);
		const objectNames = Array.from(
			new Set([...Object.keys(defaults), ...Object.keys(csvFixtures)]),
		).sort((left, right) => left.localeCompare(right));

		sendJson(res, 200, {
			dataDir,
			objects: objectNames.map((name) => {
				const hasCsv = Object.prototype.hasOwnProperty.call(csvFixtures, name);
				const records = hasCsv ? csvFixtures[name] : defaults[name];
				return {
					name,
					source: hasCsv ? "csv" : "default",
					count: records.length,
					records,
				};
			}),
		});
		return;
	}

	const objectMatch = pathname.match(
		new RegExp(`^${escapeRegExp(apiBase)}/objects/([^/]+)$`),
	);
	if (objectMatch) {
		const objectName = objectMatch[1] ?? "";
		assertValidObjectName(objectName);

		if (method === "PUT") {
			const body = await readJsonBody(req);
			if (!isRecord(body) || !Array.isArray(body.records)) {
				sendJson(res, 400, { error: "Expected JSON body with a records array." });
				return;
			}

			const records = body.records.filter(isRecord).map((record) => ({ ...record }));
			await writeCsvFixture(dataDir, objectName, records);
			sendJson(res, 200, { objectName, source: "csv", records });
			return;
		}

		if (method === "DELETE") {
			await deleteCsvFixture(dataDir, objectName);
			sendJson(res, 200, { objectName, deleted: true });
			return;
		}
	}

	sendJson(res, 404, { error: "Unknown Salesforce mock data endpoint." });
}

async function readCsvFixtureMap(dataDir: string): Promise<Record<string, SalesforceMockRecord[]>> {
	let entries: string[];
	try {
		entries = await fs.readdir(dataDir);
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") {
			return {};
		}
		throw error;
	}

	const fixtures: Record<string, SalesforceMockRecord[]> = {};
	for (const entry of entries) {
		if (!entry.endsWith(".csv")) continue;
		const objectName = entry.slice(0, -4);
		if (!isValidObjectName(objectName)) continue;
		const csv = await fs.readFile(path.join(dataDir, entry), "utf8");
		fixtures[objectName] = parseCsv(csv);
	}
	return fixtures;
}

async function writeCsvFixture(
	dataDir: string,
	objectName: string,
	records: SalesforceMockRecord[],
): Promise<void> {
	await fs.mkdir(dataDir, { recursive: true });
	await fs.writeFile(path.join(dataDir, `${objectName}.csv`), stringifyCsv(records), "utf8");
}

async function deleteCsvFixture(dataDir: string, objectName: string): Promise<void> {
	try {
		await fs.unlink(path.join(dataDir, `${objectName}.csv`));
	} catch (error) {
		if (!isNodeError(error) || error.code !== "ENOENT") {
			throw error;
		}
	}
}

function parseCsv(csv: string): SalesforceMockRecord[] {
	const rows = parseCsvRows(csv);
	const [headers, ...dataRows] = rows;
	if (!headers) {
		return [];
	}

	return dataRows
		.filter((row) => row.some((value) => value.trim() !== ""))
		.map((row) =>
			Object.fromEntries(
				headers
					.map((header) => header.trim())
					.filter(Boolean)
					.map((header, index) => [header, row[index] ?? ""]),
			),
		);
}

function stringifyCsv(records: SalesforceMockRecord[]): string {
	const columns = getColumns(records);
	const rows = [
		columns,
		...records.map((record) =>
			columns.map((column) => serializeCsvValue(record[column])),
		),
	];
	return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function parseCsvRows(csv: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let inQuotes = false;

	for (let index = 0; index < csv.length; index += 1) {
		const char = csv[index];
		const next = csv[index + 1];

		if (char === '"') {
			if (inQuotes && next === '"') {
				cell += '"';
				index += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (char === "," && !inQuotes) {
			row.push(cell);
			cell = "";
			continue;
		}

		if ((char === "\n" || char === "\r") && !inQuotes) {
			if (char === "\r" && next === "\n") {
				index += 1;
			}
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
			continue;
		}

		cell += char;
	}

	row.push(cell);
	if (row.length > 1 || row[0] !== "" || rows.length === 0) {
		rows.push(row);
	}

	return rows;
}

function getColumns(records: SalesforceMockRecord[]): string[] {
	const columns = new Set<string>();
	for (const preferred of ["Id", "Name"]) {
		if (records.some((record) => preferred in record)) {
			columns.add(preferred);
		}
	}
	for (const record of records) {
		for (const column of Object.keys(record)) {
			columns.add(column);
		}
	}
	if (columns.size === 0) {
		columns.add("Id");
		columns.add("Name");
	}
	return [...columns];
}

function serializeCsvValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function escapeCsvCell(value: string): string {
	if (!/[",\n\r]/.test(value)) {
		return value;
	}
	return `"${value.replace(/"/g, '""')}"`;
}

function readJsonBody(req: MiddlewareRequest): Promise<unknown> {
	return new Promise((resolve, reject) => {
		let body = "";
		const stream = req as MiddlewareRequest & {
			on(event: "data", listener: (chunk: Buffer) => void): void;
			on(event: "end", listener: () => void): void;
			on(event: "error", listener: (error: Error) => void): void;
		};
		stream.on("data", (chunk) => {
			body += chunk.toString("utf8");
		});
		stream.on("end", () => {
			try {
				resolve(body ? JSON.parse(body) : undefined);
			} catch (error) {
				reject(error);
			}
		});
		stream.on("error", reject);
	});
}

function renderMockDataPage(apiBase: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Salesforce Mock Data</title>
<style>
:root {
	color-scheme: light;
	font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	background: #f6f7f9;
	color: #18212f;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; }
button, input { font: inherit; }
button {
	border: 1px solid #c7ced8;
	background: #ffffff;
	color: #18212f;
	border-radius: 6px;
	padding: 8px 10px;
	cursor: pointer;
}
button.primary { background: #176b5f; border-color: #176b5f; color: #ffffff; }
button.danger { color: #9a241f; }
button:disabled { opacity: 0.5; cursor: default; }
.app { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 100vh; }
.sidebar { border-right: 1px solid #d8dde6; background: #ffffff; padding: 18px 14px; }
.brand { font-size: 16px; font-weight: 700; margin: 0 0 14px; }
.object-list { display: grid; gap: 4px; }
.object-button {
	width: 100%;
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 8px;
	text-align: left;
	border: 0;
	border-radius: 6px;
	background: transparent;
	padding: 9px 8px;
}
.object-button.active { background: #e8f2ef; color: #124f46; }
.object-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count { color: #687386; font-size: 12px; }
.main { min-width: 0; padding: 18px 20px 24px; }
.toolbar {
	display: flex;
	gap: 8px;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 14px;
}
.toolbar-left, .toolbar-right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.title { font-size: 20px; font-weight: 700; margin: 0; }
.meta { color: #687386; font-size: 13px; margin-left: 8px; }
.table-wrap {
	background: #ffffff;
	border: 1px solid #d8dde6;
	border-radius: 8px;
	overflow: auto;
	max-height: calc(100vh - 92px);
}
table { border-collapse: collapse; width: 100%; min-width: 720px; }
th, td { border-bottom: 1px solid #e2e6ec; border-right: 1px solid #edf0f4; padding: 8px; min-width: 150px; vertical-align: top; }
th { position: sticky; top: 0; z-index: 1; background: #f8fafc; text-align: left; font-size: 12px; color: #475467; }
td[contenteditable="true"] { outline: 0; min-height: 34px; }
td[contenteditable="true"]:focus { box-shadow: inset 0 0 0 2px #2f8074; background: #f4fbf9; }
.row-actions, th.row-actions { min-width: 72px; width: 72px; text-align: center; }
.empty {
	background: #ffffff;
	border: 1px solid #d8dde6;
	border-radius: 8px;
	padding: 34px;
	color: #687386;
}
.status { min-height: 20px; color: #475467; font-size: 13px; }
@media (max-width: 800px) {
	.app { grid-template-columns: 1fr; }
	.sidebar { border-right: 0; border-bottom: 1px solid #d8dde6; }
	.object-list { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
	.toolbar { align-items: flex-start; flex-direction: column; }
}
</style>
</head>
<body>
<div class="app">
	<aside class="sidebar">
		<h1 class="brand">Salesforce Mock Data</h1>
		<div class="object-list" id="objectList"></div>
	</aside>
	<main class="main">
		<div class="toolbar">
			<div class="toolbar-left">
				<h2 class="title" id="title">Mock Data</h2>
				<span class="meta" id="meta"></span>
			</div>
			<div class="toolbar-right">
				<button id="newObjectButton">New Object</button>
				<button id="addColumnButton">Add Field</button>
				<button id="addRowButton">Add Row</button>
				<button id="uploadButton">Upload CSV</button>
				<button id="downloadButton">Download CSV</button>
				<button class="danger" id="resetButton">Reset</button>
				<button class="primary" id="saveButton">Save</button>
				<input id="fileInput" type="file" accept=".csv,text/csv" hidden />
			</div>
		</div>
		<div class="status" id="status"></div>
		<div id="content"></div>
	</main>
</div>
<script>
const API_BASE = ${JSON.stringify(apiBase)};
const state = { objects: [], currentName: "", dirty: false };
const objectList = document.getElementById("objectList");
const title = document.getElementById("title");
const meta = document.getElementById("meta");
const statusEl = document.getElementById("status");
const content = document.getElementById("content");
const fileInput = document.getElementById("fileInput");

document.getElementById("newObjectButton").addEventListener("click", newObject);
document.getElementById("addColumnButton").addEventListener("click", addColumn);
document.getElementById("addRowButton").addEventListener("click", addRow);
document.getElementById("uploadButton").addEventListener("click", () => fileInput.click());
document.getElementById("downloadButton").addEventListener("click", downloadCsv);
document.getElementById("resetButton").addEventListener("click", resetCurrent);
document.getElementById("saveButton").addEventListener("click", saveCurrent);
fileInput.addEventListener("change", uploadCsv);

load();

async function load(preferredName) {
	setStatus("Loading...");
	const response = await fetch(API_BASE + "/objects", { headers: { Accept: "application/json" } });
	const payload = await response.json();
	state.objects = payload.objects || [];
	state.currentName = preferredName || state.currentName || (state.objects[0] && state.objects[0].name) || "";
	state.dirty = false;
	render();
	setStatus("");
}

function render() {
	renderSidebar();
	renderTable();
}

function renderSidebar() {
	objectList.innerHTML = "";
	for (const object of state.objects) {
		const button = document.createElement("button");
		button.className = "object-button" + (object.name === state.currentName ? " active" : "");
		button.innerHTML = "<span class=\\"object-name\\"></span><span class=\\"count\\"></span>";
		button.querySelector(".object-name").textContent = object.name;
		button.querySelector(".count").textContent = String(object.count);
		button.addEventListener("click", () => {
			if (state.dirty && !confirm("Discard unsaved changes?")) return;
			state.currentName = object.name;
			state.dirty = false;
			render();
		});
		objectList.appendChild(button);
	}
}

function renderTable() {
	const object = getCurrentObject();
	if (!object) {
		title.textContent = "Mock Data";
		meta.textContent = "";
		content.innerHTML = "<div class=\\"empty\\">Create an object or upload a CSV.</div>";
		return;
	}

	title.textContent = object.name;
	meta.textContent = object.source === "csv" ? "CSV" : "default";
	const columns = getColumns(object.records);
	if (object.records.length === 0) object.records.push(emptyRow(columns));

	const wrap = document.createElement("div");
	wrap.className = "table-wrap";
	const table = document.createElement("table");
	const thead = document.createElement("thead");
	const headRow = document.createElement("tr");
	for (const column of columns) {
		const th = document.createElement("th");
		th.textContent = column;
		headRow.appendChild(th);
	}
	const actionHead = document.createElement("th");
	actionHead.className = "row-actions";
	actionHead.textContent = "";
	headRow.appendChild(actionHead);
	thead.appendChild(headRow);
	table.appendChild(thead);

	const tbody = document.createElement("tbody");
	object.records.forEach((record, rowIndex) => {
		const tr = document.createElement("tr");
		columns.forEach((column) => {
			const td = document.createElement("td");
			td.contentEditable = "true";
			td.dataset.row = String(rowIndex);
			td.dataset.field = column;
			td.textContent = cellToString(record[column]);
			td.addEventListener("input", () => {
				record[column] = td.textContent || "";
				markDirty();
			});
			tr.appendChild(td);
		});
		const actionCell = document.createElement("td");
		actionCell.className = "row-actions";
		const deleteButton = document.createElement("button");
		deleteButton.textContent = "Delete";
		deleteButton.addEventListener("click", () => {
			object.records.splice(rowIndex, 1);
			markDirty();
			render();
		});
		actionCell.appendChild(deleteButton);
		tr.appendChild(actionCell);
		tbody.appendChild(tr);
	});
	table.appendChild(tbody);
	wrap.appendChild(table);
	content.replaceChildren(wrap);
}

function getCurrentObject() {
	return state.objects.find((object) => object.name === state.currentName);
}

function getColumns(records) {
	const columns = new Set();
	if (records.some((record) => "Id" in record)) columns.add("Id");
	if (records.some((record) => "Name" in record)) columns.add("Name");
	records.forEach((record) => Object.keys(record).forEach((key) => columns.add(key)));
	if (columns.size === 0) {
		columns.add("Id");
		columns.add("Name");
	}
	return [...columns];
}

function emptyRow(columns) {
	return Object.fromEntries(columns.map((column) => [column, ""]));
}

function markDirty() {
	state.dirty = true;
	setStatus("Unsaved changes");
}

function setStatus(message) {
	statusEl.textContent = message;
}

function assertObjectName(name) {
	if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
		throw new Error("Use a Salesforce API name like Account or Invoice__c.");
	}
}

function newObject() {
	const name = prompt("Object API name", "Invoice__c");
	if (!name) return;
	try {
		assertObjectName(name);
	} catch (error) {
		alert(error.message);
		return;
	}
	if (!state.objects.some((object) => object.name === name)) {
		state.objects.push({ name, source: "csv", count: 1, records: [{ Id: "", Name: "" }] });
	}
	state.currentName = name;
	state.dirty = true;
	render();
}

function addColumn() {
	const object = getCurrentObject();
	if (!object) return;
	const fieldName = prompt("Field API name", "Status__c");
	if (!fieldName) return;
	if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(fieldName)) {
		alert("Use a field API name like Status__c.");
		return;
	}
	object.records.forEach((record) => {
		if (!(fieldName in record)) record[fieldName] = "";
	});
	markDirty();
	render();
}

function addRow() {
	const object = getCurrentObject();
	if (!object) return;
	object.records.push(emptyRow(getColumns(object.records)));
	object.count = object.records.length;
	markDirty();
	render();
}

async function saveCurrent() {
	const object = getCurrentObject();
	if (!object) return;
	setStatus("Saving...");
	await fetch(API_BASE + "/objects/" + encodeURIComponent(object.name), {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ records: object.records }),
	});
	await load(object.name);
	setStatus("Saved to mock-data/" + object.name + ".csv");
}

async function resetCurrent() {
	const object = getCurrentObject();
	if (!object) return;
	if (!confirm("Remove the CSV override for " + object.name + "?")) return;
	await fetch(API_BASE + "/objects/" + encodeURIComponent(object.name), { method: "DELETE" });
	await load(object.name);
	setStatus("Reset " + object.name);
}

function downloadCsv() {
	const object = getCurrentObject();
	if (!object) return;
	const blob = new Blob([stringifyCsv(object.records)], { type: "text/csv" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = object.name + ".csv";
	link.click();
	URL.revokeObjectURL(link.href);
}

async function uploadCsv() {
	const file = fileInput.files && fileInput.files[0];
	fileInput.value = "";
	if (!file) return;
	const fallbackName = file.name.replace(/\\.csv$/i, "");
	const objectName = state.currentName || fallbackName;
	const records = parseCsv(await file.text());
	let targetName = objectName;
	if (!targetName || !/^[A-Za-z][A-Za-z0-9_]*$/.test(targetName)) {
		targetName = prompt("Object API name", fallbackName) || "";
	}
	try {
		assertObjectName(targetName);
	} catch (error) {
		alert(error.message);
		return;
	}
	const existing = state.objects.find((object) => object.name === targetName);
	if (existing) {
		existing.records = records;
		existing.count = records.length;
		existing.source = "csv";
	} else {
		state.objects.push({ name: targetName, source: "csv", count: records.length, records });
	}
	state.currentName = targetName;
	state.dirty = true;
	render();
}

function parseCsv(csv) {
	const rows = parseCsvRows(csv);
	const headers = rows.shift() || [];
	return rows
		.filter((row) => row.some((value) => value.trim() !== ""))
		.map((row) => Object.fromEntries(headers.map((header, index) => [header.trim(), row[index] || ""]).filter(([key]) => key)));
}

function stringifyCsv(records) {
	const columns = getColumns(records);
	const rows = [columns, ...records.map((record) => columns.map((column) => cellToString(record[column])))];
	return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\\n") + "\\n";
}

function cellToString(value) {
	if (value == null) return "";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function parseCsvRows(csv) {
	const rows = [];
	let row = [];
	let cell = "";
	let inQuotes = false;
	for (let index = 0; index < csv.length; index += 1) {
		const char = csv[index];
		const next = csv[index + 1];
		if (char === "\\"") {
			if (inQuotes && next === "\\"") {
				cell += "\\"";
				index += 1;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === "," && !inQuotes) {
			row.push(cell);
			cell = "";
		} else if ((char === "\\n" || char === "\\r") && !inQuotes) {
			if (char === "\\r" && next === "\\n") index += 1;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else {
			cell += char;
		}
	}
	row.push(cell);
	if (row.length > 1 || row[0] !== "" || rows.length === 0) rows.push(row);
	return rows;
}

function escapeCsvCell(value) {
	return /[",\\n\\r]/.test(value) ? "\\"" + value.replace(/"/g, "\\"\\"") + "\\"" : value;
}
</script>
</body>
</html>`;
}

function sendHtml(res: MiddlewareResponse, html: string): void {
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/html; charset=utf-8");
	res.end(html);
}

function sendJson(res: MiddlewareResponse, statusCode: number, payload: unknown): void {
	res.statusCode = statusCode;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.end(JSON.stringify(payload));
}

function normalizeRoute(route: string): string {
	const normalized = route.startsWith("/") ? route : `/${route}`;
	return normalized.endsWith("/") && normalized.length > 1
		? normalized.slice(0, -1)
		: normalized;
}

function assertValidObjectName(objectName: string): void {
	if (!isValidObjectName(objectName)) {
		throw new Error(`Invalid Salesforce object API name: ${objectName}`);
	}
}

function isValidObjectName(objectName: string): boolean {
	return /^[A-Za-z][A-Za-z0-9_]*$/.test(objectName);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}

function isRecord(value: unknown): value is SalesforceMockRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
