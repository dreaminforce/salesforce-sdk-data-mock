import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

import { salesforceMockDataPlugin } from "../dist/vite.js";

function matchesAlias(find, importId) {
	if (find instanceof RegExp) return find.test(importId);
	return importId === find || importId.startsWith(`${find}/`);
}

test("the Vite plugin contributes exact Data SDK aliases", () => {
	const pluginConfig = salesforceMockDataPlugin().config();
	const aliases = pluginConfig.resolve.alias;

	assert.equal(aliases.length, 2);
	assert.equal(aliases[0].find.test("@salesforce/platform-sdk/data"), true);
	assert.equal(aliases[0].find.test("@salesforce/platform-sdk/data/extra"), false);
	assert.equal(aliases[1].find.test("@salesforce/platform-sdk"), true);
	assert.equal(aliases[1].find.test("@salesforce/platform-sdk/chat"), false);
	assert.equal(aliases[0].replacement.endsWith("/dist/index.js"), true);
	assert.equal(aliases[1].replacement, aliases[0].replacement);
});

test("Vite preserves generated aliases and resolves only Data SDK imports to the mock", async () => {
	const server = await createServer({
		configFile: false,
		logLevel: "silent",
		plugins: [salesforceMockDataPlugin()],
		resolve: {
			alias: {
				"@": "/project/src",
				"@api": "/project/src/api",
				"@future-salesforce-alias": "/project/src/future",
			},
		},
		optimizeDeps: { noDiscovery: true, include: [] },
		server: { middlewareMode: true },
	});

	try {
		const aliases = server.config.resolve.alias;
		const dataSdk = await server.pluginContainer.resolveId(
			"@salesforce/platform-sdk/data",
		);
		const packageRoot = await server.pluginContainer.resolveId(
			"@salesforce/platform-sdk",
		);
		const unrelatedModule = await server.pluginContainer.resolveId(
			"@salesforce/platform-sdk/chat",
		);

		assert.equal(Array.isArray(aliases), true);
		assert.equal(
			aliases.some(
				({ find, replacement }) =>
					find === "@future-salesforce-alias" &&
					replacement === "/project/src/future",
			),
			true,
		);
		assert.equal(dataSdk.id.endsWith("/dist/index.js"), true);
		assert.equal(packageRoot.id, dataSdk.id);
		assert.equal(unrelatedModule, null);
		assert.equal(
			aliases.some(({ find }) => matchesAlias(find, "@salesforce/platform-sdk/chat")),
			false,
		);
	} finally {
		await server.close();
	}
});
