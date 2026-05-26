<img width="1024" height="1535" alt="Dreaminforce-Salesforce-sdk-data-mock" src="https://github.com/user-attachments/assets/9815cced-10c2-474d-9b6b-cc78202f8972" />

# salesforce-sdk-data-mock

Generic in-memory Vite mock for `@salesforce/sdk-data` Salesforce UI API GraphQL query patterns.

Use this when you want a Salesforce Multi-Framework React app to run locally without a live org for common `uiapi.query` reads.

## Install from GitHub

```bash
npm install -D github:dreaminforce/salesforce-sdk-data-mock
```

GitHub repo: https://github.com/dreaminforce/salesforce-sdk-data-mock

## Add mock mode

In the app's `package.json`, add:

```json
{
  "scripts": {
    "dev:mock": "vite --mode mock"
  }
}
```

Keep the normal script too:

```json
{
  "scripts": {
    "dev": "vite",
    "dev:mock": "vite --mode mock"
  }
}
```

## Add the Vite alias

In the app's `vite.config.ts`, do not replace the whole file. Make these two small edits.

### 1. Add `isMockMode`

Find this line:

```ts
export default defineConfig(({ mode }) => {
  return {
```

Change it to:

```ts
export default defineConfig(({ mode }) => {
  const isMockMode = mode === "mock";

  return {
```

### 2. Add the alias inside `resolve.alias`

Find the existing `resolve.alias` block. It usually looks similar to this:

```ts
resolve: {
  dedupe: ["react", "react-dom"],
  alias: {
    "@": path.resolve(__dirname, "./src"),
    "@api": path.resolve(__dirname, "./src/api"),
    "@components": path.resolve(__dirname, "./src/components"),
  },
},
```

Add the mock alias inside the existing `alias: { ... }` object:

```ts
resolve: {
  dedupe: ["react", "react-dom"],
  alias: {
    "@": path.resolve(__dirname, "./src"),

    ...(isMockMode
      ? {
          "@salesforce/sdk-data": "salesforce-sdk-data-mock",
        }
      : {}),

    "@api": path.resolve(__dirname, "./src/api"),
    "@components": path.resolve(__dirname, "./src/components"),
  },
},
```

The important rule is: keep all existing aliases, and only add this block:

```ts
...(isMockMode
  ? {
      "@salesforce/sdk-data": "salesforce-sdk-data-mock",
    }
  : {})
```

## Run

```bash
npm run dev:mock
```

Existing app code should keep importing from Salesforce normally:

```ts
import { createDataSDK, gql } from "@salesforce/sdk-data";
```

In normal mode, the real Salesforce SDK is used:

```bash
npm run dev
```

In mock mode, Vite swaps `@salesforce/sdk-data` to this package:

```bash
npm run dev:mock
```

## Included fixtures

The mock includes sample records for:

- `Account`
- `Contact`
- `Opportunity`
- `Case`
- `Lead`
- `User`
- `Product2`

Unknown custom objects ending in `__c` are generated dynamically.

## Add or replace fixtures

Create a mock setup file in the app, for example `src/mockSetup.ts`:

```ts
import { setSalesforceMockObjectFixtures } from "@salesforce/sdk-data";

setSalesforceMockObjectFixtures("Invoice__c", [
  {
    Id: "a00000000000000001",
    Name: "Invoice 1",
    Amount__c: 1200,
    Status__c: "Open",
  },
]);
```

Import that setup file somewhere that only runs in mock mode.

## Supported GraphQL behavior

The mock supports common Salesforce UI API connection responses:

- `data.uiapi.query.<ObjectName>.edges[].node`
- `totalCount`
- `pageInfo.hasNextPage`
- `pageInfo.hasPreviousPage`
- `pageInfo.startCursor`
- `pageInfo.endCursor`

It preserves requested fields where practical. `Id` is returned as a string. Normal fields are returned as `{ value, displayValue }` when the query asks for that shape.

Supported `where` operators:

- `eq`
- `ne`
- `like`
- `in`
- `nin`
- `gt`
- `gte`
- `lt`
- `lte`

Supported boolean filters:

- `and` / `AND`
- `or` / `OR`
- `not` / `NOT`

Supported `orderBy`:

- `ASC`
- `DESC`
- one or more fields

Supported pagination:

- `first`
- `after` with local mock cursors

## Operation overrides

Use overrides only for special operations the generic engine cannot handle:

```ts
import { addSalesforceMockGraphQLOverride } from "@salesforce/sdk-data";

addSalesforceMockGraphQLOverride(({ operationName }) => {
  if (operationName !== "SpecialOperation") return undefined;

  return {
    data: {
      uiapi: {
        query: {},
      },
    },
  };
});
```

Return `undefined` to let the generic mock engine handle the operation.

## Known limitations

This is not a full Salesforce GraphQL server. It does not enforce org schema validation, field-level security, sharing, mutations, or exact Salesforce null ordering behavior.

## Security check

This package has a very small dependency tree:

- production dependency: `graphql`
- development dependency: `typescript`
- optional peer dependency: `@salesforce/sdk-data`

Security checks run on May 26, 2026:

```bash
npm audit --omit=dev
npm audit
npm pack --dry-run
```

Results:

- `npm audit --omit=dev`: 0 vulnerabilities
- `npm audit`: 0 vulnerabilities
- OSV API check for `graphql@16.14.0` and `typescript@5.9.3`: 0 vulnerabilities returned
- GitHub vulnerability alerts are enabled for this repository

To rerun the checks later:

```bash
cd salesforce-sdk-data-mock
npm install
npm audit --omit=dev
npm audit
npm pack --dry-run
```
