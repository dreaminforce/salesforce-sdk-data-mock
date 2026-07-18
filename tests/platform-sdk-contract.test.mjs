import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
	addSalesforceMockGraphQLOverride,
	clearSalesforceMockGraphQLOverrides,
	createDataSDK,
	gql,
	resetSalesforceMockObjectFixtures,
	setSalesforceMockObjectFixtures,
} from "../dist/index.js";

const ACCOUNT_QUERY = gql`
	query Accounts($first: Int) {
		uiapi {
			query {
				Account(first: $first) {
					nodes {
						Id
						Name {
							value
							displayValue
						}
					}
				}
			}
		}
	}
`;

afterEach(() => {
	clearSalesforceMockGraphQLOverrides();
	resetSalesforceMockObjectFixtures();
});

test("createDataSDK exposes the GA graphql.query options API", async () => {
	setSalesforceMockObjectFixtures("Account", [
		{ Id: "001000000000000001", Name: "GA Account" },
	]);
	const sdk = await createDataSDK();

	assert.ok(sdk.graphql);
	const result = await sdk.graphql.query({
		query: ACCOUNT_QUERY,
		variables: { first: 1 },
	});

	assert.equal(result.errors, undefined);
	assert.equal(result.data.uiapi.query.Account.nodes[0].Name.value, "GA Account");
	assert.equal(
		result.data.uiapi.query.Account.nodes[0].Name.displayValue,
		"GA Account",
	);
	assert.equal(typeof result.subscribe, "function");
	assert.equal(typeof result.refresh, "function");
});

test("query refresh updates data and notifies active subscribers", async () => {
	setSalesforceMockObjectFixtures("Account", [
		{ Id: "001000000000000001", Name: "Before Refresh" },
	]);
	const sdk = await createDataSDK();
	const result = await sdk.graphql.query({ query: ACCOUNT_QUERY });
	const snapshots = [];
	const unsubscribe = result.subscribe((snapshot) => snapshots.push(snapshot));

	setSalesforceMockObjectFixtures("Account", [
		{ Id: "001000000000000002", Name: "After Refresh" },
	]);
	await result.refresh();

	assert.equal(result.data.uiapi.query.Account.nodes[0].Name.value, "After Refresh");
	assert.equal(snapshots.length, 1);
	assert.equal(
		snapshots[0].data.uiapi.query.Account.nodes[0].Name.value,
		"After Refresh",
	);

	unsubscribe();
	await result.refresh();
	assert.equal(snapshots.length, 1);
});

test("query selects the requested operation and reports invalid selections", async () => {
	addSalesforceMockGraphQLOverride(({ operationName }) => ({
		data: { selectedOperation: operationName },
	}));
	const sdk = await createDataSDK();
	const document = gql`
		query FirstOperation {
			uiapi {
				query {
					Account {
						totalCount
					}
				}
			}
		}
		query SecondOperation {
			uiapi {
				query {
					Contact {
						totalCount
					}
				}
			}
		}
	`;

	const selected = await sdk.graphql.query({
		query: document,
		operationName: "SecondOperation",
	});
	assert.equal(selected.data.selectedOperation, "SecondOperation");

	const missingName = await sdk.graphql.query({ query: document });
	assert.equal(missingName.data, undefined);
	assert.match(missingName.errors[0].message, /requires operationName/);

	const unknownName = await sdk.graphql.query({
		query: document,
		operationName: "UnknownOperation",
	});
	assert.equal(unknownName.data, undefined);
	assert.match(unknownName.errors[0].message, /could not find operation/);
});

test("graphql.mutate supports operation overrides and reports unsupported mutations", async () => {
	const sdk = await createDataSDK();
	const mutation = gql`
		mutation UpdateAccount($id: ID!) {
			uiapi {
				AccountUpdate(input: { Id: $id }) {
					Record {
						Id
					}
				}
			}
		}
	`;

	const unsupported = await sdk.graphql.mutate({
		mutation,
		variables: { id: "001000000000000001" },
	});
	assert.equal(unsupported.data, undefined);
	assert.match(unsupported.errors[0].message, /require an operation override/);

	let receivedContext;
	addSalesforceMockGraphQLOverride((context) => {
		receivedContext = context;
		return {
			data: {
				uiapi: {
					AccountUpdate: { Record: { Id: context.variables.id } },
				},
			},
		};
	});

	const overridden = await sdk.graphql.mutate({
		mutation,
		variables: { id: "001000000000000002" },
		operationName: "UpdateAccount",
	});
	assert.equal(receivedContext.operationType, "mutation");
	assert.equal(receivedContext.operationName, "UpdateAccount");
	assert.equal(overridden.data.uiapi.AccountUpdate.Record.Id, "001000000000000002");
});

test("query and mutate reject documents with the wrong operation type", async () => {
	const sdk = await createDataSDK();
	const queryAsMutation = await sdk.graphql.mutate({ mutation: ACCOUNT_QUERY });
	assert.equal(queryAsMutation.data, undefined);
	assert.match(queryAsMutation.errors[0].message, /cannot execute a query operation/);
});
