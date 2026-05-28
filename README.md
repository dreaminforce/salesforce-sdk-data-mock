<img width="1024" height="1535" alt="Dreaminforce-Salesforce-sdk-data-mock" src="https://github.com/user-attachments/assets/9815cced-10c2-474d-9b6b-cc78202f8972" />

# salesforce-sdk-data-mock

`salesforce-sdk-data-mock` is a Vite-only local mock for common Salesforce UI API GraphQL reads made through `@salesforce/sdk-data`.

Use it when a Salesforce Multi-Framework React app needs to run locally without connecting to a live Salesforce org.

Your application code keeps the normal Salesforce import:

```ts
import { createDataSDK, gql } from "@salesforce/sdk-data";
```

In normal mode, the app uses the real Salesforce SDK. In mock mode, Vite aliases `@salesforce/sdk-data` to this package.

## How It Helps Salesforce Development

Salesforce front-end work often depends on org data, permissions, sample records, and network access. This package removes that dependency for local UI development.

It helps teams:

- Run Salesforce UI Bundle apps locally without a live org
- Build and test React UI states with stable sample data
- Share predictable mock records across developers
- Edit local data through a browser page instead of changing code
- Keep production imports unchanged while using mocks only in Vite mock mode

This package is not a Salesforce server replacement. It is intended for local development of UI API GraphQL read flows.

## What Is Headless 360?

Headless 360 is Salesforce's shift from a UI-first platform experience to a platform that can also be used through APIs, MCP tools, and CLI commands. Instead of every user or agent needing to work inside the standard Salesforce browser UI, Salesforce capabilities can be brought into custom apps, automation flows, AI-agent workflows, developer tools, and other external surfaces.

In simple terms:

- Salesforce remains the system of record
- Business data, metadata, and platform capabilities are exposed through programmable interfaces
- Developers can build custom experiences on top of Salesforce
- AI agents and automation tools can act on Salesforce data without opening the Salesforce UI
- Teams can deliver Salesforce-powered workflows in the places where users already work

This helps Salesforce teams because the CRM data and business logic stay governed in Salesforce, while the user experience can be built for a specific channel, role, or workflow.

## How This Package Fits Headless 360

Headless 360 development still needs front-end screens, data-driven components, and local test data. During local development, connecting every UI state to a real Salesforce org can slow teams down.

This package helps with the local UI-development part of that workflow. It mocks the `@salesforce/sdk-data` layer in Vite, so your React app can keep its real Salesforce data-access code while local development receives mock `uiapi.query` responses.

Use this package when you want to:

- Build Salesforce-powered UI screens outside the standard Salesforce UI
- Develop record list, detail, and related-data views with local mock records
- Test UI states without depending on org access, auth, permissions, or live data
- Upload and edit local CSV data through `/mock-data`
- Switch back to the real Salesforce SDK by running the normal Vite command

The package does not replace Headless 360 APIs or Salesforce. It makes local development easier for apps that consume Salesforce data through `@salesforce/sdk-data`.

## Installation

Run these commands from the Vite app folder, not from a parent Salesforce project folder.

For Salesforce UI Bundles, this is usually:

```txt
force-app/main/default/uiBundles/<your-bundle-name>
```

Use the folder that contains both:

- `package.json`
- `vite.config.ts`

If your Salesforce project also has a root `package.json`, do not install this package there.

Install the app dependencies, then install the mock package:

```bash
npm install
npm install -D github:dreaminforce/salesforce-sdk-data-mock
```

## Package Script

Add a separate mock script to the app `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "dev:mock": "vite --mode mock"
  }
}
```

Keep the existing `dev` script. The mock script is only for local mock mode.

## Vite Configuration

Update the app `vite.config.ts`. Do not replace the whole file; add the mock pieces to the existing config.

### Import the Plugin

```ts
import { salesforceMockDataPlugin } from "salesforce-sdk-data-mock/vite";
```

### Detect Mock Mode

Inside `defineConfig`, add `isMockMode`:

```ts
export default defineConfig(({ mode }) => {
  const isMockMode = mode === "mock";

  return {
    // existing config
  };
});
```

### Enable the Mock Data Plugin

Add the plugin only in mock mode:

```ts
plugins: [
  ...(isMockMode ? [salesforceMockDataPlugin()] : []),
  // keep existing plugins here
],
```

### Add the SDK Alias

Add this block inside the existing `resolve.alias` object:

```ts
resolve: {
  alias: {
    ...(isMockMode
      ? {
          "@salesforce/sdk-data": "salesforce-sdk-data-mock",
        }
      : {}),

    // keep existing aliases here
  },
},
```

The alias is what makes existing imports resolve to the mock package in `dev:mock`.

## Running the App

Run with mock Salesforce data:

```bash
npm run dev:mock
```

Run with the real Salesforce SDK:

```bash
npm run dev
```

## `/mock-data` Data Screen

When the Vite plugin is enabled, the package adds a local data-management screen:

```txt
http://localhost:<your-vite-port>/mock-data
```

Use this screen to manage mock Salesforce records without editing source code. It shows each object in an editable datatable, so you can view and update the data your app receives from `@salesforce/sdk-data` in mock mode.

The `/mock-data` screen lets you:

- View mock records in datatables
- Update record values by editing table cells
- Add rows
- Add fields
- Create a custom object
- Upload CSV files to replace or seed object data
- Download object data as CSV
- Reset an object to the package defaults

When you save changes or upload a CSV, files are written into the app:

```txt
mock-data/Account.csv
mock-data/Contact.csv
mock-data/Invoice__c.csv
```

In mock mode, CSV files take priority over the built-in sample records. If no CSV exists for an object, the built-in records are used.

## Built-in Data

The package includes sample records for:

- `Account`
- `Contact`
- `Opportunity`
- `Case`
- `Lead`
- `User`
- `Product2`

Unknown custom objects ending in `__c` are generated dynamically.

## Custom Data

### Use a Different Data Folder or Editor Path

```ts
salesforceMockDataPlugin({
  dataDir: "mock-data",
  pagePath: "/mock-data",
});
```

### Add Fixtures in Code

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

Import that setup file only when the app runs in mock mode.

## Operation Overrides

Use an override only when the generic mock engine cannot handle a specific GraphQL operation:

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

## Supported GraphQL Behavior

The mock supports common Salesforce UI API query and aggregate responses:

- `data.uiapi.query.<ObjectName>.edges[].node`
- `data.uiapi.query.<ObjectName>.nodes[]`
- `data.uiapi.query.<ObjectName>.totalCount`
- `data.uiapi.query.<ObjectName>.pageInfo`
- `data.uiapi.aggregate.<ObjectName>`

Supported filters:

- `eq`
- `ne`
- `like`
- `in`
- `nin`
- `gt`
- `gte`
- `lt`
- `lte`
- `and` / `AND`
- `or` / `OR`
- `not` / `NOT`

Supported sorting and pagination:

- `orderBy` with `ASC` or `DESC`
- `first`
- `after` with local mock cursors

Fields are returned in the requested GraphQL shape where practical. `Id` is returned as a string. Standard fields are returned as `{ value, displayValue }` when the query asks for that shape.

## Troubleshooting

### `Missing script: "dev:mock"`

You are probably in the wrong folder, or the script was added to a different `package.json`. Run the command from the folder that contains the UI bundle `package.json`.

### The app still calls the real Salesforce SDK

Check that:

- You started the app with `npm run dev:mock`
- `const isMockMode = mode === "mock"` is inside `defineConfig`
- The `@salesforce/sdk-data` alias is inside `resolve.alias`
- Existing aliases were preserved

### `/mock-data` does not open

Check that:

- `salesforceMockDataPlugin()` is included in the Vite `plugins` array
- The app was started with `npm run dev:mock`
- You are using the Vite port shown by Vite

## Limitations

This is not a full Salesforce GraphQL server. It does not enforce org schema validation, field-level security, sharing, mutations, or exact Salesforce null ordering behavior.

## Maintenance Checks

This package has a small dependency tree:

- production dependency: `graphql`
- development dependency: `typescript`
- optional peer dependencies: `@salesforce/sdk-data`, `vite`

To rerun local checks:

```bash
npm install
npm audit --omit=dev
npm audit
npm pack --dry-run
```
