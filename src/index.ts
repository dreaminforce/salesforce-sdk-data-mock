import {
	Kind,
	parse,
	print,
	type ArgumentNode,
	type DocumentNode,
	type FieldNode,
	type FragmentDefinitionNode,
	type OperationDefinitionNode,
	type SelectionNode,
	type SelectionSetNode,
	type ValueNode,
} from "graphql";

type Variables = Record<string, unknown>;
type MockScalar = string | number | boolean | null;
export type SalesforceMockRecord = Record<string, unknown>;
type MockRecord = SalesforceMockRecord;

export interface SDKOptions {
	surface?: string;
}

export type StatusCallback = () => Promise<unknown> | void;

export interface WebAppDataSDKOptions {
	basePath?: string;
	onStatus?: Partial<Record<number, StatusCallback>>;
}

export type MosaicDataSDKOptions = object;

export interface DataSDKOptions extends SDKOptions {
	webapp?: WebAppDataSDKOptions;
	mosaic?: MosaicDataSDKOptions;
}

export interface GraphQLError {
	message: string;
	locations?: Array<{ line: number; column: number }>;
	path?: string[];
}

export type GraphQLRawDocument = string;
export type GraphQLRequestHeaders = HeadersInit;

export interface GraphQLRequest<TVariables = Variables> {
	query: string;
	variables?: TVariables;
	operationName?: string;
	headers?: GraphQLRequestHeaders;
}

export interface GraphQLResponse<TData> {
	data: TData;
	errors?: GraphQLError[];
}

export type CacheControl = "no-cache" | "only-if-cached" | {
	type: "max-age";
	maxAge: number;
};

export interface QueryOptions<TVariables = Variables> {
	query: GraphQLRawDocument;
	variables?: TVariables;
	operationName?: string;
	cacheControl?: CacheControl;
	headers?: GraphQLRequestHeaders;
}

export interface MutateOptions<TVariables = Variables> {
	mutation: GraphQLRawDocument;
	variables?: TVariables;
	operationName?: string;
	headers?: GraphQLRequestHeaders;
}

export interface QuerySnapshot<TData> {
	data: TData | undefined;
	errors?: GraphQLError[];
}

export type QuerySubscriber<TData> = (snapshot: QuerySnapshot<TData>) => void;
export type Unsubscribe = () => void;

export interface QueryResult<TData> extends QuerySnapshot<TData> {
	subscribe(callback: QuerySubscriber<TData>): Unsubscribe;
	refresh(): Promise<void>;
}

export interface MutationResult<TData> {
	data: TData | undefined;
	errors?: GraphQLError[];
}

export interface DataSDKGraphQL {
	query<TData, TVariables = Variables>(
		options: QueryOptions<TVariables>,
	): Promise<QueryResult<TData>>;
	mutate<TData, TVariables = Variables>(
		options: MutateOptions<TVariables>,
	): Promise<MutationResult<TData>>;
}

export interface DataSDK {
	graphql?: DataSDKGraphQL;
	fetch?: typeof fetch;
}

export type NodeOfConnection<T> = T extends {
	edges?: Array<infer TEdge> | null;
} | null
	? TEdge extends { node?: infer TNode } | null
		? TNode
		: never
	: never;

type MockGraphQLResult<TData = unknown> = {
	data?: TData;
	errors?: GraphQLError[];
};

export type SalesforceMockOperationType = "query" | "mutation";

export type SalesforceMockGraphQLContext = {
	query: string;
	document: DocumentNode;
	operationType: SalesforceMockOperationType;
	operationName?: string;
	variables: Variables;
	fixtures: Record<string, MockRecord[]>;
};

export type SalesforceMockGraphQLOverride = (
	context: SalesforceMockGraphQLContext,
) => MockGraphQLResult | undefined | Promise<MockGraphQLResult | undefined>;

const COMMON_OBJECT_NAMES = new Set([
	"Account",
	"Contact",
	"Opportunity",
	"Case",
	"Lead",
	"User",
	"Product2",
]);
const FIELD_WRAPPER_KEYS = new Set(["value", "displayValue", "label", "format"]);
const OPERATORS = new Set(["eq", "ne", "like", "in", "nin", "gt", "gte", "lt", "lte"]);
const LOGICAL_KEYS = new Set(["and", "or", "not", "AND", "OR", "NOT"]);

const graphqlOverrides: SalesforceMockGraphQLOverride[] = [];
const fixtureOverrides: Record<string, MockRecord[]> = {};
const CSV_FIXTURES_ENDPOINT = "/__salesforce_sdk_data_mock__/fixtures";
const CSV_FIXTURES_CACHE_MS = 500;
const CSV_FIXTURES_FAILURE_CACHE_MS = 5_000;
let csvFixturesCache:
	| {
			fixtures: Record<string, MockRecord[]>;
			loadedAt: number;
			cacheMs: number;
	  }
	| undefined;

function salesforceId(prefix: string, index: number): string {
	return `${prefix}${String(index).padStart(15, "0")}`;
}

const userAda = {
	Id: salesforceId("005", 1),
	Name: "Ada Lovelace",
	Email: "ada.lovelace@example.test",
	Username: "ada.lovelace@example.test",
	Title: "Sales Manager",
	IsActive: true,
};

const userGrace = {
	Id: salesforceId("005", 2),
	Name: "Grace Hopper",
	Email: "grace.hopper@example.test",
	Username: "grace.hopper@example.test",
	Title: "Account Executive",
	IsActive: true,
};

const accountAcme = {
	Id: salesforceId("001", 1),
	Name: "Acme Corporation",
	Industry: "Technology",
	Type: "Customer - Direct",
	Phone: "(415) 555-0100",
	Fax: "(415) 555-0199",
	Website: "https://acme.example.test",
	AnnualRevenue: 7_500_000,
	NumberOfEmployees: 350,
	Description: "Strategic technology account.",
	BillingStreet: "100 Market St",
	BillingCity: "San Francisco",
	BillingState: "CA",
	BillingPostalCode: "94105",
	BillingCountry: "US",
	ShippingStreet: "100 Market St",
	ShippingCity: "San Francisco",
	ShippingState: "CA",
	ShippingPostalCode: "94105",
	ShippingCountry: "US",
	CreatedDate: "2024-01-12T10:00:00.000Z",
	LastModifiedDate: "2026-02-18T15:30:00.000Z",
	Owner: userAda,
	CreatedBy: userAda,
	LastModifiedBy: userGrace,
};

const accountGlobal = {
	Id: salesforceId("001", 2),
	Name: "Global Media",
	Industry: "Media",
	Type: "Prospect",
	Phone: "(212) 555-0190",
	Fax: "(212) 555-0191",
	Website: "https://globalmedia.example.test",
	AnnualRevenue: 2_400_000,
	NumberOfEmployees: 120,
	Description: "Regional media prospect.",
	BillingStreet: "22 Madison Ave",
	BillingCity: "New York",
	BillingState: "NY",
	BillingPostalCode: "10010",
	BillingCountry: "US",
	ShippingStreet: "22 Madison Ave",
	ShippingCity: "New York",
	ShippingState: "NY",
	ShippingPostalCode: "10010",
	ShippingCountry: "US",
	CreatedDate: "2024-04-03T08:15:00.000Z",
	LastModifiedDate: "2026-01-07T11:20:00.000Z",
	Owner: userGrace,
	CreatedBy: userGrace,
	LastModifiedBy: userGrace,
};

const accountPioneer = {
	Id: salesforceId("001", 3),
	Name: "Pioneer Health",
	Industry: "Healthcare",
	Type: "Customer - Channel",
	Phone: "(312) 555-0144",
	Fax: "(312) 555-0145",
	Website: "https://pioneerhealth.example.test",
	AnnualRevenue: 11_250_000,
	NumberOfEmployees: 540,
	Description: "Healthcare customer account.",
	BillingStreet: "9 Lakeshore Dr",
	BillingCity: "Chicago",
	BillingState: "IL",
	BillingPostalCode: "60601",
	BillingCountry: "US",
	ShippingStreet: "9 Lakeshore Dr",
	ShippingCity: "Chicago",
	ShippingState: "IL",
	ShippingPostalCode: "60601",
	ShippingCountry: "US",
	CreatedDate: "2023-11-21T09:45:00.000Z",
	LastModifiedDate: "2026-03-01T13:05:00.000Z",
	Owner: userAda,
	CreatedBy: userAda,
	LastModifiedBy: userAda,
};

const baseFixtures: Record<string, MockRecord[]> = {
	Account: [accountAcme, accountGlobal, accountPioneer],
	Contact: [
		{
			Id: salesforceId("003", 1),
			FirstName: "Maya",
			LastName: "Chen",
			Name: "Maya Chen",
			Email: "maya.chen@acme.example.test",
			Phone: "(415) 555-0130",
			Title: "VP Operations",
			AccountId: accountAcme.Id,
			Account: accountAcme,
			Owner: userAda,
			CreatedDate: "2025-02-01T12:00:00.000Z",
		},
		{
			Id: salesforceId("003", 2),
			FirstName: "Noah",
			LastName: "Patel",
			Name: "Noah Patel",
			Email: "noah.patel@globalmedia.example.test",
			Phone: "(212) 555-0188",
			Title: "Director of Strategy",
			AccountId: accountGlobal.Id,
			Account: accountGlobal,
			Owner: userGrace,
			CreatedDate: "2025-04-19T16:20:00.000Z",
		},
	],
	Opportunity: [
		{
			Id: salesforceId("006", 1),
			Name: "Acme Expansion",
			AccountId: accountAcme.Id,
			Account: accountAcme,
			StageName: "Proposal/Price Quote",
			Amount: 180_000,
			CloseDate: "2026-06-30",
			IsClosed: false,
			Owner: userAda,
		},
		{
			Id: salesforceId("006", 2),
			Name: "Pioneer Renewal",
			AccountId: accountPioneer.Id,
			Account: accountPioneer,
			StageName: "Negotiation/Review",
			Amount: 320_000,
			CloseDate: "2026-07-15",
			IsClosed: false,
			Owner: userAda,
		},
	],
	Case: [
		{
			Id: salesforceId("500", 1),
			CaseNumber: "00001001",
			Subject: "Integration setup question",
			Status: "New",
			Priority: "Medium",
			Origin: "Web",
			AccountId: accountAcme.Id,
			Account: accountAcme,
			Owner: userGrace,
		},
		{
			Id: salesforceId("500", 2),
			CaseNumber: "00001002",
			Subject: "Billing address update",
			Status: "Working",
			Priority: "Low",
			Origin: "Email",
			AccountId: accountPioneer.Id,
			Account: accountPioneer,
			Owner: userAda,
		},
	],
	Lead: [
		{
			Id: salesforceId("00Q", 1),
			FirstName: "Iris",
			LastName: "Morgan",
			Name: "Iris Morgan",
			Company: "Northstar Labs",
			Email: "iris.morgan@northstar.example.test",
			Status: "Open - Not Contacted",
			AnnualRevenue: 950_000,
			Owner: userGrace,
		},
		{
			Id: salesforceId("00Q", 2),
			FirstName: "Leo",
			LastName: "Garcia",
			Name: "Leo Garcia",
			Company: "Blue Ridge Services",
			Email: "leo.garcia@blueridge.example.test",
			Status: "Working - Contacted",
			AnnualRevenue: 1_450_000,
			Owner: userAda,
		},
	],
	User: [userAda, userGrace],
	Product2: [
		{
			Id: salesforceId("01t", 1),
			Name: "Enterprise Platform",
			ProductCode: "ENT-PLATFORM",
			Family: "Software",
			IsActive: true,
			Description: "Core enterprise subscription.",
		},
		{
			Id: salesforceId("01t", 2),
			Name: "Premium Support",
			ProductCode: "SUP-PREMIUM",
			Family: "Services",
			IsActive: true,
			Description: "Enhanced support package.",
		},
	],
};

export function gql(strings: TemplateStringsArray, ...values: unknown[]): string;
export function gql(strings: string): string;
export function gql(strings: TemplateStringsArray | string, ...values: unknown[]): string {
	if (typeof strings === "string") {
		return strings;
	}

	return strings.reduce((query, part, index) => `${query}${part}${values[index] ?? ""}`, "");
}

export function addSalesforceMockGraphQLOverride(
	override: SalesforceMockGraphQLOverride,
): () => void {
	graphqlOverrides.push(override);
	return () => {
		const index = graphqlOverrides.indexOf(override);
		if (index >= 0) {
			graphqlOverrides.splice(index, 1);
		}
	};
}

export function clearSalesforceMockGraphQLOverrides(): void {
	graphqlOverrides.length = 0;
}

export function setSalesforceMockObjectFixtures(objectName: string, records: MockRecord[]): void {
	fixtureOverrides[objectName] = records.map((record) => ({ ...record }));
}

export function resetSalesforceMockObjectFixtures(objectName?: string): void {
	if (objectName) {
		delete fixtureOverrides[objectName];
		return;
	}

	for (const key of Object.keys(fixtureOverrides)) {
		delete fixtureOverrides[key];
	}
}

export function getSalesforceMockDefaultFixtures(): Record<string, MockRecord[]> {
	return cloneFixtureMap(baseFixtures);
}

export async function createDataSDK(options?: DataSDKOptions): Promise<DataSDK> {
	void options;

	const graphql: DataSDKGraphQL = {
		query: executeMockQuery,
		mutate: executeMockMutation,
	};

	return {
		graphql,
	};
}

async function executeMockQuery<TData, TVariables = Variables>(
	options: QueryOptions<TVariables>,
): Promise<QueryResult<TData>> {
	if (bypassesFixtureCache(options.cacheControl)) {
		csvFixturesCache = undefined;
	}

	const initial = await executeGraphQL<TData>(
		options.query,
		normalizeVariables(options.variables),
		"query",
		options.operationName,
	);
	const subscribers = new Set<QuerySubscriber<TData>>();
	const result: QueryResult<TData> = {
		data: initial.data,
		errors: initial.errors,
		subscribe(callback) {
			subscribers.add(callback);
			return () => subscribers.delete(callback);
		},
		async refresh() {
			csvFixturesCache = undefined;
			const refreshed = await executeGraphQL<TData>(
				options.query,
				normalizeVariables(options.variables),
				"query",
				options.operationName,
			);
			result.data = refreshed.data;
			if (refreshed.errors) {
				result.errors = refreshed.errors;
			} else {
				delete result.errors;
			}

			const snapshot = { data: result.data, errors: result.errors };
			for (const subscriber of subscribers) {
				try {
					subscriber(snapshot);
				} catch {
					// A subscriber must not prevent other subscribers from receiving a refresh.
				}
			}
		},
	};

	return result;
}

async function executeMockMutation<TData, TVariables = Variables>(
	options: MutateOptions<TVariables>,
): Promise<MutationResult<TData>> {
	const result = await executeGraphQL<TData>(
		options.mutation,
		normalizeVariables(options.variables),
		"mutation",
		options.operationName,
	);
	return { data: result.data, errors: result.errors };
}

async function executeGraphQL<TData>(
	queryInput: string | DocumentNode,
	variables: Variables,
	expectedOperationType: SalesforceMockOperationType,
	requestedOperationName?: string,
): Promise<MockGraphQLResult<TData>> {
	try {
		const query = typeof queryInput === "string" ? queryInput : print(queryInput);
		const document = typeof queryInput === "string" ? parse(queryInput) : queryInput;
		const operations = document.definitions.filter(
			(definition): definition is OperationDefinitionNode =>
				definition.kind === Kind.OPERATION_DEFINITION,
		);
		const operation = requestedOperationName
			? operations.find((definition) => definition.name?.value === requestedOperationName)
			: operations.length === 1
				? operations[0]
				: undefined;

		if (!operation) {
			const message = requestedOperationName
				? `Mock GraphQL could not find operation "${requestedOperationName}".`
				: operations.length > 1
					? "Mock GraphQL requires operationName when a document contains multiple operations."
					: "Mock GraphQL expected an operation definition.";
			return { data: undefined, errors: [{ message }] };
		}

		if (operation.operation !== expectedOperationType) {
			return {
				data: undefined,
				errors: [
					{
						message: `Mock GraphQL ${expectedOperationType}() cannot execute a ${operation.operation} operation.`,
					},
				],
			};
		}

		const operationName = operation?.name?.value;
		const fixtures = await getFixtureMap();
		const context: SalesforceMockGraphQLContext = {
			query,
			document,
			operationType: expectedOperationType,
			operationName,
			variables,
			fixtures,
		};

		for (const override of graphqlOverrides) {
			const result = await override(context);
			if (result) {
				return result as MockGraphQLResult<TData>;
			}
		}

		if (expectedOperationType === "mutation") {
			return {
				data: undefined,
				errors: [
					{
						message:
							"Mock GraphQL mutations require an operation override. Register one with addSalesforceMockGraphQLOverride().",
					},
				],
			};
		}

		return { data: executeUiApiOperation(operation, document, variables, fixtures) as TData };
	} catch (error) {
		return {
			data: undefined,
			errors: [
				{
					message: error instanceof Error ? error.message : "Mock GraphQL execution failed.",
				},
			],
		};
	}
}

function bypassesFixtureCache(cacheControl: CacheControl | undefined): boolean {
	return (
		cacheControl === "no-cache" ||
		(typeof cacheControl === "object" &&
			cacheControl.type === "max-age" &&
			cacheControl.maxAge === 0)
	);
}

function executeUiApiOperation(
	operation: OperationDefinitionNode,
	document: DocumentNode,
	variables: Variables,
	fixtures: Record<string, MockRecord[]>,
): { uiapi: Record<string, unknown> } {
	const fragments = getFragments(document);
	const topLevelSelections = collectSelections(operation.selectionSet, fragments);
	const uiapiField = topLevelSelections.find(
		(selection): selection is FieldNode =>
			selection.kind === Kind.FIELD && selection.name.value === "uiapi",
	);
	const uiapi: Record<string, unknown> = {};

	if (!uiapiField?.selectionSet) {
		return { uiapi };
	}

	const uiapiSelections = collectSelections(uiapiField.selectionSet, fragments);
	const queryField = findSelectedField(uiapiSelections, "query");
	if (queryField?.selectionSet) {
		uiapi.query = executeQueryBranch(queryField, fragments, variables, fixtures);
	}

	const aggregateField = findSelectedField(uiapiSelections, "aggregate");
	if (aggregateField?.selectionSet) {
		uiapi.aggregate = executeAggregateBranch(aggregateField, fragments, variables, fixtures);
	}

	return { uiapi };
}

function executeQueryBranch(
	queryField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
	variables: Variables,
	fixtures: Record<string, MockRecord[]>,
): Record<string, unknown> {
	const response: Record<string, unknown> = {};
	const objectFields = collectSelections(queryField.selectionSet!, fragments).filter(
		(selection): selection is FieldNode =>
			selection.kind === Kind.FIELD && isSupportedObjectName(selection.name.value),
	);

	for (const objectField of objectFields) {
		const objectName = objectField.name.value;
		const responseKey = objectField.alias?.value ?? objectName;
		const args = getArguments(objectField.arguments ?? [], variables);
		const allRecords = getRecords(objectName, fixtures);
		const filtered = allRecords.filter((record) => matchesWhere(record, args.where));
		const ordered = applyOrderBy(filtered, args.orderBy);
		response[responseKey] = buildConnection(objectName, ordered, objectField, fragments, args);
	}

	return response;
}

function executeAggregateBranch(
	aggregateField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
	variables: Variables,
	fixtures: Record<string, MockRecord[]>,
): Record<string, unknown> {
	const response: Record<string, unknown> = {};
	const objectFields = collectSelections(aggregateField.selectionSet!, fragments).filter(
		(selection): selection is FieldNode =>
			selection.kind === Kind.FIELD && isSupportedObjectName(selection.name.value),
	);

	for (const objectField of objectFields) {
		const objectName = objectField.name.value;
		const responseKey = objectField.alias?.value ?? objectName;
		const args = getArguments(objectField.arguments ?? [], variables);
		const records = getRecords(objectName, fixtures).filter((record) =>
			matchesWhere(record, args.where),
		);
		response[responseKey] = buildAggregateConnection(records, objectField, fragments, args);
	}

	return response;
}

function buildConnection(
	objectName: string,
	records: MockRecord[],
	objectField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
	args: Variables,
): Record<string, unknown> {
	const first = typeof args.first === "number" ? Math.max(0, args.first) : records.length;
	const afterIndex = decodeCursor(args.after);
	const startIndex = afterIndex + 1;
	const pageRecords = records.slice(startIndex, startIndex + first);
	const hasNextPage = startIndex + first < records.length;
	const hasPreviousPage = startIndex > 0;
	const selections = collectSelections(objectField.selectionSet, fragments);
	const connection: Record<string, unknown> = {};

	for (const selection of selections) {
		if (selection.kind !== Kind.FIELD) continue;
		const responseKey = selection.alias?.value ?? selection.name.value;

		switch (selection.name.value) {
			case "edges": {
				connection[responseKey] = pageRecords.map((record, offset) =>
					buildEdge(objectName, record, startIndex + offset, selection, fragments),
				);
				break;
			}
			case "nodes": {
				connection[responseKey] = pageRecords.map((record) =>
					buildSelectedRecord(objectName, record, selection, fragments),
				);
				break;
			}
			case "totalCount":
				connection[responseKey] = records.length;
				break;
			case "pageInfo":
				connection[responseKey] = buildPageInfo(
					pageRecords,
					startIndex,
					hasNextPage,
					hasPreviousPage,
					selection,
					fragments,
				);
				break;
			case "__typename":
				connection[responseKey] = `${objectName}Connection`;
				break;
			default:
				connection[responseKey] = null;
				break;
		}
	}

	return connection;
}

function buildEdge(
	objectName: string,
	record: MockRecord,
	index: number,
	edgeField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
): Record<string, unknown> {
	const edge: Record<string, unknown> = {};
	const selections = collectSelections(edgeField.selectionSet, fragments);

	for (const selection of selections) {
		if (selection.kind !== Kind.FIELD) continue;
		const responseKey = selection.alias?.value ?? selection.name.value;

		if (selection.name.value === "node") {
			edge[responseKey] = buildSelectedRecord(objectName, record, selection, fragments);
		} else if (selection.name.value === "cursor") {
			edge[responseKey] = encodeCursor(index);
		} else if (selection.name.value === "__typename") {
			edge[responseKey] = `${objectName}Edge`;
		}
	}

	return edge;
}

function buildPageInfo(
	pageRecords: MockRecord[],
	startIndex: number,
	hasNextPage: boolean,
	hasPreviousPage: boolean,
	pageInfoField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
): Record<string, unknown> {
	const pageInfo: Record<string, unknown> = {};
	const selections = collectSelections(pageInfoField.selectionSet, fragments);
	const endIndex = startIndex + pageRecords.length - 1;

	for (const selection of selections) {
		if (selection.kind !== Kind.FIELD) continue;
		const responseKey = selection.alias?.value ?? selection.name.value;

		switch (selection.name.value) {
			case "hasNextPage":
				pageInfo[responseKey] = hasNextPage;
				break;
			case "hasPreviousPage":
				pageInfo[responseKey] = hasPreviousPage;
				break;
			case "startCursor":
				pageInfo[responseKey] = pageRecords.length ? encodeCursor(startIndex) : null;
				break;
			case "endCursor":
				pageInfo[responseKey] = pageRecords.length ? encodeCursor(endIndex) : null;
				break;
			case "__typename":
				pageInfo[responseKey] = "PageInfo";
				break;
		}
	}

	return pageInfo;
}

function buildSelectedRecord(
	objectName: string,
	record: MockRecord,
	nodeField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
): Record<string, unknown> {
	const node: Record<string, unknown> = {};
	const selections = collectSelections(nodeField.selectionSet, fragments);

	for (const selection of selections) {
		if (selection.kind !== Kind.FIELD) continue;

		const fieldName = selection.name.value;
		const responseKey = selection.alias?.value ?? fieldName;

		if (fieldName === "__typename") {
			node[responseKey] = objectName;
			continue;
		}

		const rawValue = getFieldValue(record, fieldName, objectName);

		if (fieldName === "Id" && !selection.selectionSet) {
			node[responseKey] = String(rawValue);
			continue;
		}

		if (!selection.selectionSet) {
			node[responseKey] = unwrapFieldValue(rawValue);
			continue;
		}

		if (isFieldValueWrapperSelection(selection.selectionSet, fragments)) {
			node[responseKey] = buildFieldValueWrapper(rawValue, selection, fragments);
			continue;
		}

		const relatedRecord =
			isRecord(rawValue) ? rawValue : createRelationshipRecord(fieldName, objectName);
		node[responseKey] = buildSelectedRecord(fieldName, relatedRecord, selection, fragments);
	}

	return node;
}

function buildFieldValueWrapper(
	rawValue: unknown,
	field: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
): Record<string, MockScalar> {
	const value = normalizeScalar(unwrapFieldValue(rawValue));
	const wrapper: Record<string, MockScalar> = {};

	for (const selection of collectSelections(field.selectionSet, fragments)) {
		if (selection.kind !== Kind.FIELD) continue;
		const responseKey = selection.alias?.value ?? selection.name.value;

		switch (selection.name.value) {
			case "value":
				wrapper[responseKey] = value;
				break;
			case "displayValue":
			case "label":
				wrapper[responseKey] = formatDisplayValue(value);
				break;
			case "format":
				wrapper[responseKey] = null;
				break;
			case "__typename":
				wrapper[responseKey] = "FieldValue";
				break;
		}
	}

	return wrapper;
}

function buildAggregateConnection(
	records: MockRecord[],
	objectField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
	args: Variables,
): Record<string, unknown> {
	const groupFields = getGroupByFields(args.groupBy);
	const selectedAggregateFields = getSelectedAggregateFields(objectField, fragments);
	const fields = groupFields.length > 0 ? groupFields : selectedAggregateFields;
	const groups = new Map<string, MockRecord>();

	for (const record of records) {
		const key = fields.map((field) => String(unwrapFieldValue(getFieldValue(record, field)))).join("|");
		if (!groups.has(key)) {
			groups.set(key, record);
		}
	}

	const selections = collectSelections(objectField.selectionSet, fragments);
	const connection: Record<string, unknown> = {};

	for (const selection of selections) {
		if (selection.kind !== Kind.FIELD) continue;
		const responseKey = selection.alias?.value ?? selection.name.value;

		if (selection.name.value === "edges") {
			connection[responseKey] = Array.from(groups.values()).map((record, index) =>
				buildAggregateEdge(record, index, selection, fragments, fields),
			);
		} else if (selection.name.value === "totalCount") {
			connection[responseKey] = groups.size;
		} else if (selection.name.value === "pageInfo") {
			connection[responseKey] = buildPageInfo(
				Array.from(groups.values()),
				0,
				false,
				false,
				selection,
				fragments,
			);
		}
	}

	return connection;
}

function buildAggregateEdge(
	record: MockRecord,
	index: number,
	edgeField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
	groupFields: string[],
): Record<string, unknown> {
	const edge: Record<string, unknown> = {};

	for (const selection of collectSelections(edgeField.selectionSet, fragments)) {
		if (selection.kind !== Kind.FIELD) continue;
		const responseKey = selection.alias?.value ?? selection.name.value;

		if (selection.name.value === "cursor") {
			edge[responseKey] = encodeCursor(index);
		} else if (selection.name.value === "node") {
			edge[responseKey] = buildAggregateNode(record, selection, fragments, groupFields);
		}
	}

	return edge;
}

function buildAggregateNode(
	record: MockRecord,
	nodeField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
	groupFields: string[],
): Record<string, unknown> {
	const node: Record<string, unknown> = {};

	for (const selection of collectSelections(nodeField.selectionSet, fragments)) {
		if (selection.kind !== Kind.FIELD) continue;
		const responseKey = selection.alias?.value ?? selection.name.value;

		if (selection.name.value === "aggregate") {
			node[responseKey] = buildAggregatePayload(record, selection, fragments, groupFields);
		} else if (selection.name.value === "__typename") {
			node[responseKey] = "AggregateNode";
		}
	}

	return node;
}

function buildAggregatePayload(
	record: MockRecord,
	aggregateField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
	groupFields: string[],
): Record<string, unknown> {
	const aggregate: Record<string, unknown> = {};
	const selections = collectSelections(aggregateField.selectionSet, fragments);
	const selectedFields = selections
		.filter((selection): selection is FieldNode => selection.kind === Kind.FIELD)
		.map((selection) => selection.name.value)
		.filter((fieldName) => fieldName !== "__typename");
	const fields = selectedFields.length > 0 ? selectedFields : groupFields;

	for (const fieldName of fields) {
		const fieldSelection = selections.find(
			(selection): selection is FieldNode =>
				selection.kind === Kind.FIELD && selection.name.value === fieldName,
		);
		if (!fieldSelection) continue;
		aggregate[fieldSelection.alias?.value ?? fieldName] = buildFieldValueWrapper(
			getFieldValue(record, fieldName),
			fieldSelection,
			fragments,
		);
	}

	return aggregate;
}

function matchesWhere(record: unknown, where: unknown): boolean {
	if (!where || !isRecord(where)) {
		return true;
	}

	return Object.entries(where).every(([key, condition]) => {
		if (condition === undefined || condition === null) {
			return true;
		}

		if (isLogicalKey(key)) {
			return evaluateLogicalFilter(record, key, condition);
		}

		const fieldValue = getFieldValue(asRecord(record), key);

		if (isOperatorObject(condition)) {
			return Object.entries(condition).every(([operator, expected]) =>
				evaluateOperator(fieldValue, operator, expected),
			);
		}

		return matchesWhere(fieldValue, condition);
	});
}

function evaluateLogicalFilter(record: unknown, key: string, condition: unknown): boolean {
	const normalizedKey = key.toLowerCase();

	if (normalizedKey === "and") {
		const filters = Array.isArray(condition) ? condition : [condition];
		return filters.every((filter) => matchesWhere(record, filter));
	}

	if (normalizedKey === "or") {
		const filters = Array.isArray(condition) ? condition : [condition];
		return filters.some((filter) => matchesWhere(record, filter));
	}

	return !matchesWhere(record, condition);
}

function evaluateOperator(fieldValue: unknown, operator: string, expected: unknown): boolean {
	const actual = unwrapFieldValue(fieldValue);
	const comparisonValue = unwrapComparisonValue(expected);

	switch (operator) {
		case "eq":
			return compareValues(actual, comparisonValue) === 0;
		case "ne":
			return compareValues(actual, comparisonValue) !== 0;
		case "like":
			return matchesLike(actual, comparisonValue);
		case "in":
			return Array.isArray(comparisonValue)
				? comparisonValue.some((value) => compareValues(actual, unwrapComparisonValue(value)) === 0)
				: false;
		case "nin":
			return Array.isArray(comparisonValue)
				? comparisonValue.every((value) => compareValues(actual, unwrapComparisonValue(value)) !== 0)
				: true;
		case "gt":
			return compareValues(actual, comparisonValue) > 0;
		case "gte":
			return compareValues(actual, comparisonValue) >= 0;
		case "lt":
			return compareValues(actual, comparisonValue) < 0;
		case "lte":
			return compareValues(actual, comparisonValue) <= 0;
		default:
			return true;
	}
}

function applyOrderBy(records: MockRecord[], orderBy: unknown): MockRecord[] {
	const sortFields = normalizeOrderBy(orderBy);
	if (sortFields.length === 0) {
		return [...records];
	}

	return [...records].sort((left, right) => {
		for (const sortField of sortFields) {
			const comparison = compareValues(
				unwrapFieldValue(getFieldValue(left, sortField.field)),
				unwrapFieldValue(getFieldValue(right, sortField.field)),
			);
			if (comparison !== 0) {
				return sortField.direction === "DESC" ? -comparison : comparison;
			}
		}
		return 0;
	});
}

function normalizeOrderBy(orderBy: unknown): Array<{ field: string; direction: "ASC" | "DESC" }> {
	if (!orderBy) {
		return [];
	}

	const orderObjects = Array.isArray(orderBy) ? orderBy : [orderBy];
	const sortFields: Array<{ field: string; direction: "ASC" | "DESC" }> = [];

	for (const orderObject of orderObjects) {
		if (!isRecord(orderObject)) continue;

		for (const [field, clause] of Object.entries(orderObject)) {
			if (!clause) continue;
			const order =
				typeof clause === "string"
					? clause
					: isRecord(clause)
						? String(clause.order ?? clause.direction ?? "ASC")
						: "ASC";
			sortFields.push({
				field,
				direction: order.toUpperCase() === "DESC" ? "DESC" : "ASC",
			});
		}
	}

	return sortFields;
}

function compareValues(left: unknown, right: unknown): number {
	const comparableLeft = toComparable(left);
	const comparableRight = toComparable(right);

	if (comparableLeft === null && comparableRight === null) return 0;
	if (comparableLeft === null) return 1;
	if (comparableRight === null) return -1;
	if (typeof comparableLeft === "number" && typeof comparableRight === "number") {
		return comparableLeft - comparableRight;
	}

	return String(comparableLeft).localeCompare(String(comparableRight), undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

function toComparable(value: unknown): string | number | boolean | null {
	const unwrapped = unwrapComparisonValue(value);
	if (unwrapped === undefined || unwrapped === null) return null;
	if (typeof unwrapped === "number" || typeof unwrapped === "boolean") return unwrapped;
	if (unwrapped instanceof Date) return unwrapped.getTime();

	const stringValue = String(unwrapped);
	const numericValue = Number(stringValue);
	if (stringValue.trim() !== "" && Number.isFinite(numericValue)) {
		return numericValue;
	}

	const dateValue = Date.parse(stringValue);
	if (Number.isFinite(dateValue) && /\d{4}-\d{2}-\d{2}/.test(stringValue)) {
		return dateValue;
	}

	return stringValue;
}

function matchesLike(actual: unknown, expected: unknown): boolean {
	const actualValue = String(unwrapFieldValue(actual) ?? "").toLowerCase();
	const pattern = String(unwrapComparisonValue(expected) ?? "").toLowerCase();

	if (!pattern.includes("%")) {
		return actualValue.includes(pattern) || actualValue === pattern;
	}

	const matcher = new RegExp(
		`^${pattern
			.split("%")
			.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
			.join(".*")}$`,
		"i",
	);
	return matcher.test(actualValue);
}

function getFieldValue(record: MockRecord, fieldName: string, objectName = "MockObject"): unknown {
	if (fieldName in record) {
		return record[fieldName];
	}

	return generateFieldValue(fieldName, objectName, 1);
}

function generateFieldValue(fieldName: string, objectName: string, index: number): MockScalar {
	if (fieldName === "Id" || fieldName.endsWith("Id")) {
		return salesforceId(getIdPrefix(fieldName.replace(/Id$/, "")), index);
	}
	if (/email/i.test(fieldName)) {
		return `${fieldName.toLowerCase()}${index}@example.test`;
	}
	if (/date/i.test(fieldName)) {
		return fieldName.toLowerCase().includes("datetime")
			? "2026-01-15T12:00:00.000Z"
			: "2026-01-15";
	}
	if (/(amount|revenue|number|count|quantity|employees)/i.test(fieldName)) {
		return index * 1000;
	}
	if (/^(is|has)[A-Z_]/.test(fieldName)) {
		return index % 2 === 1;
	}
	if (/name/i.test(fieldName)) {
		return `${objectName} ${index}`;
	}
	if (fieldName.endsWith("__c")) {
		return `${fieldName.replace(/__c$/, "").replace(/_/g, " ")} ${index}`;
	}

	return `${fieldName} ${index}`;
}

function createRelationshipRecord(fieldName: string, objectName: string): MockRecord {
	return {
		Id: salesforceId(getIdPrefix(fieldName), 1),
		Name: `${fieldName} for ${objectName}`,
		Email: `${fieldName.toLowerCase()}@example.test`,
	};
}

function getRecords(objectName: string, fixtures: Record<string, MockRecord[]>): MockRecord[] {
	const records = fixtures[objectName];
	if (records?.length) {
		return records;
	}

	return Array.from({ length: 3 }, (_, index) => generateFallbackRecord(objectName, index + 1));
}

function generateFallbackRecord(objectName: string, index: number): MockRecord {
	return {
		Id: salesforceId(getIdPrefix(objectName), index),
		Name: `${objectName.replace(/__c$/, "").replace(/_/g, " ")} ${index}`,
		Owner: userAda,
		CreatedDate: `2026-01-${String(index).padStart(2, "0")}T12:00:00.000Z`,
		LastModifiedDate: `2026-02-${String(index).padStart(2, "0")}T12:00:00.000Z`,
	};
}

function getIdPrefix(objectName: string): string {
	switch (objectName) {
		case "Account":
			return "001";
		case "Contact":
			return "003";
		case "Opportunity":
			return "006";
		case "Case":
			return "500";
		case "Lead":
			return "00Q";
		case "User":
		case "Owner":
		case "CreatedBy":
		case "LastModifiedBy":
			return "005";
		case "Product2":
			return "01t";
		default:
			return "a00";
	}
}

async function getFixtureMap(): Promise<Record<string, MockRecord[]>> {
	const csvFixtures = await loadCsvFixtureMap();
	return {
		...baseFixtures,
		...csvFixtures,
		...fixtureOverrides,
	};
}

async function loadCsvFixtureMap(): Promise<Record<string, MockRecord[]>> {
	if (typeof fetch !== "function") {
		return {};
	}

	const now = Date.now();
	if (csvFixturesCache && now - csvFixturesCache.loadedAt < csvFixturesCache.cacheMs) {
		return csvFixturesCache.fixtures;
	}

	try {
		const response = await fetch(CSV_FIXTURES_ENDPOINT, {
			cache: "no-store",
			headers: {
				Accept: "application/json",
			},
		});
		const contentType = response.headers.get("content-type") ?? "";
		if (!response.ok || !contentType.includes("application/json")) {
			throw new Error("CSV fixture endpoint is unavailable.");
		}

		const payload = (await response.json()) as { fixtures?: unknown };
		const fixtures = normalizeFixtureMap(payload.fixtures);
		csvFixturesCache = {
			fixtures,
			loadedAt: now,
			cacheMs: CSV_FIXTURES_CACHE_MS,
		};
		return fixtures;
	} catch {
		csvFixturesCache = {
			fixtures: {},
			loadedAt: now,
			cacheMs: CSV_FIXTURES_FAILURE_CACHE_MS,
		};
		return {};
	}
}

function normalizeFixtureMap(value: unknown): Record<string, MockRecord[]> {
	if (!isRecord(value)) {
		return {};
	}

	const fixtures: Record<string, MockRecord[]> = {};
	for (const [objectName, records] of Object.entries(value)) {
		if (!Array.isArray(records)) continue;
		fixtures[objectName] = records.filter(isRecord).map((record) => ({ ...record }));
	}
	return fixtures;
}

function cloneFixtureMap(fixtures: Record<string, MockRecord[]>): Record<string, MockRecord[]> {
	return Object.fromEntries(
		Object.entries(fixtures).map(([objectName, records]) => [
			objectName,
			records.map((record) => structuredCloneFallback(record)),
		]),
	);
}

function structuredCloneFallback<T>(value: T): T {
	if (typeof structuredClone === "function") {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value)) as T;
}

function getArguments(args: readonly ArgumentNode[], variables: Variables): Variables {
	return Object.fromEntries(args.map((arg) => [arg.name.value, valueNodeToValue(arg.value, variables)]));
}

function valueNodeToValue(value: ValueNode, variables: Variables): unknown {
	switch (value.kind) {
		case Kind.VARIABLE:
			return variables[value.name.value];
		case Kind.NULL:
			return null;
		case Kind.INT:
			return Number.parseInt(value.value, 10);
		case Kind.FLOAT:
			return Number.parseFloat(value.value);
		case Kind.STRING:
		case Kind.BOOLEAN:
		case Kind.ENUM:
			return value.value;
		case Kind.LIST:
			return value.values.map((item) => valueNodeToValue(item, variables));
		case Kind.OBJECT:
			return Object.fromEntries(
				value.fields.map((field) => [field.name.value, valueNodeToValue(field.value, variables)]),
			);
		default:
			return undefined;
	}
}

function getFragments(document: DocumentNode): Map<string, FragmentDefinitionNode> {
	return new Map(
		document.definitions
			.filter(
				(definition): definition is FragmentDefinitionNode =>
					definition.kind === Kind.FRAGMENT_DEFINITION,
			)
			.map((fragment) => [fragment.name.value, fragment]),
	);
}

function collectSelections(
	selectionSet: SelectionSetNode | undefined,
	fragments: Map<string, FragmentDefinitionNode>,
): SelectionNode[] {
	if (!selectionSet) {
		return [];
	}

	return selectionSet.selections.flatMap((selection) => {
		if (selection.kind === Kind.FRAGMENT_SPREAD) {
			return collectSelections(fragments.get(selection.name.value)?.selectionSet, fragments);
		}
		if (selection.kind === Kind.INLINE_FRAGMENT) {
			return collectSelections(selection.selectionSet, fragments);
		}
		return [selection];
	});
}

function findSelectedField(selections: SelectionNode[], fieldName: string): FieldNode | undefined {
	return selections.find(
		(selection): selection is FieldNode =>
			selection.kind === Kind.FIELD && selection.name.value === fieldName,
	);
}

function isFieldValueWrapperSelection(
	selectionSet: SelectionSetNode,
	fragments: Map<string, FragmentDefinitionNode>,
): boolean {
	const selections = collectSelections(selectionSet, fragments).filter(
		(selection): selection is FieldNode => selection.kind === Kind.FIELD,
	);
	return (
		selections.length > 0 &&
		selections.every((selection) => FIELD_WRAPPER_KEYS.has(selection.name.value))
	);
}

function isSupportedObjectName(name: string): boolean {
	return COMMON_OBJECT_NAMES.has(name) || name.endsWith("__c");
}

function getGroupByFields(groupBy: unknown): string[] {
	if (!isRecord(groupBy)) {
		return [];
	}

	return Object.entries(groupBy)
		.filter(([, config]) => !isRecord(config) || config.group !== false)
		.map(([field]) => field);
}

function getSelectedAggregateFields(
	objectField: FieldNode,
	fragments: Map<string, FragmentDefinitionNode>,
): string[] {
	const edgeField = findSelectedField(collectSelections(objectField.selectionSet, fragments), "edges");
	const nodeField = edgeField
		? findSelectedField(collectSelections(edgeField.selectionSet, fragments), "node")
		: undefined;
	const aggregateField = nodeField
		? findSelectedField(collectSelections(nodeField.selectionSet, fragments), "aggregate")
		: undefined;

	if (!aggregateField) {
		return [];
	}

	return collectSelections(aggregateField.selectionSet, fragments)
		.filter((selection): selection is FieldNode => selection.kind === Kind.FIELD)
		.map((field) => field.name.value)
		.filter((fieldName) => fieldName !== "__typename");
}

function normalizeVariables(variables: unknown): Variables {
	return isRecord(variables) ? variables : {};
}

function isLogicalKey(key: string): boolean {
	return LOGICAL_KEYS.has(key);
}

function isOperatorObject(value: unknown): value is Record<string, unknown> {
	return isRecord(value) && Object.keys(value).some((key) => OPERATORS.has(key));
}

function unwrapComparisonValue(value: unknown): unknown {
	if (isRecord(value) && "value" in value && Object.keys(value).length <= 2) {
		return value.value;
	}
	return value;
}

function unwrapFieldValue(value: unknown): unknown {
	if (isRecord(value) && "value" in value && Object.keys(value).length <= 3) {
		return value.value;
	}
	return value;
}

function normalizeScalar(value: unknown): MockScalar {
	if (value === undefined || value === null) return null;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	return String(value);
}

function formatDisplayValue(value: MockScalar): string | null {
	if (value === null) return null;
	if (typeof value === "number") return new Intl.NumberFormat("en-US").format(value);
	if (typeof value === "boolean") return value ? "True" : "False";
	return value;
}

function encodeCursor(index: number): string {
	return `mock-cursor-${index}`;
}

function decodeCursor(cursor: unknown): number {
	if (typeof cursor !== "string") {
		return -1;
	}
	const match = cursor.match(/^mock-cursor-(\d+)$/);
	return match ? Number.parseInt(match[1], 10) : -1;
}

function isRecord(value: unknown): value is MockRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): MockRecord {
	return isRecord(value) ? value : {};
}
