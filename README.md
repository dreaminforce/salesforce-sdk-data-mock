# salesforce-sdk-data-mock

Generic in-memory Vite mock for `@salesforce/sdk-data` Salesforce UI API GraphQL query patterns.

Use this when you want a Salesforce Multi-Framework React app to run locally without a live org for common `uiapi.query` reads.

## Install from GitHub

Replace `YOUR_GITHUB_USERNAME_OR_ORG` and `REPO_NAME` with the GitHub repo where this package is pushed:

```bash
npm install -D github:YOUR_GITHUB_USERNAME_OR_ORG/REPO_NAME
```

Example:

```bash
npm install -D github:acme/salesforce-sdk-data-mock
```

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

In the app's `vite.config.ts`, alias `@salesforce/sdk-data` only in mock mode:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias:
      mode === "mock"
        ? {
            "@salesforce/sdk-data": "salesforce-sdk-data-mock",
          }
        : {},
  },
}));
```

If the app already has aliases, merge the mock alias into the existing `resolve.alias` object.

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
