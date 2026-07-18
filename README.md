<img width="1024" height="1535" alt="Dreaminforce-Salesforce-sdk-data-mock" src="https://github.com/user-attachments/assets/9815cced-10c2-474d-9b6b-cc78202f8972" />

# salesforce-sdk-data-mock

`salesforce-sdk-data-mock` is a Vite-only local mock for common Salesforce UI API GraphQL operations made through the GA `@salesforce/platform-sdk` Data SDK.

Use it when a Salesforce Multi-Framework React app needs to run locally without connecting to a live Salesforce org.

Your application code keeps the normal Salesforce import:

```ts
import { createDataSDK, gql } from "@salesforce/platform-sdk/data";
```

In normal mode, the app uses the real Salesforce SDK. In mock mode, Vite aliases the Data SDK imports to this package.

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

This package helps with the local UI-development part of that workflow. It mocks the `@salesforce/platform-sdk` Data SDK layer in Vite, so your React app can keep its real Salesforce data-access code while local development receives mock `uiapi.query` responses.

Use this package when you want to:

- Build Salesforce-powered UI screens outside the standard Salesforce UI
- Develop record list, detail, and related-data views with local mock records
- Test UI states without depending on org access, auth, permissions, or live data
- Upload and edit local CSV data through `/mock-data`
- Switch back to the real Salesforce SDK by running the normal Vite command

The package does not replace Headless 360 APIs or Salesforce. It makes local development easier for apps that consume Salesforce data through `@salesforce/platform-sdk/data`.

## Migrating from the Beta Data SDK

Salesforce Multi-Framework GA replaces the beta `@salesforce/sdk-data` package and generic `graphql()` method. Application code should now:

- Import Data SDK functions from `@salesforce/platform-sdk/data`
- Call `dataSdk.graphql?.query({ query, variables })` for reads
- Call `dataSdk.graphql?.mutate({ mutation, variables })` for writes
- Treat `result.data` as potentially undefined

This mock implements that GA interface. The old beta `dataSdk.graphql(query, variables)` interface is no longer exposed.

## Create a Salesforce GA React Project

Use a current Salesforce CLI release that includes the React UI Bundle generator. Confirm the command is available:

```bash
sf template generate ui-bundle --help
```

For a new Salesforce DX project, run:

```bash
sf template generate project --name MySalesforceProject
cd MySalesforceProject

sf template generate ui-bundle \
  --name MyReactApp \
  --label "My React App" \
  --template reactbasic \
  --output-dir force-app/main/default/uiBundles
```

If you already have a Salesforce DX project, run only the `ui-bundle` command from its root. The generated React application is created at:

```txt
force-app/main/default/uiBundles/MyReactApp
```

The current `reactbasic` template requires Node.js 22 or later and already uses the GA `@salesforce/platform-sdk` `query()` and `mutate()` interfaces.

### Understand the Two `package.json` Files

The generated Salesforce project contains a root package and a separate React application package:

```txt
MySalesforceProject/                                  # Salesforce DX project root
├── package.json                                      # Root tooling; do not add this mock here
├── sfdx-project.json
└── force-app/main/default/uiBundles/
    └── MyReactApp/                                   # UI Bundle app folder
        ├── package.json                              # Add the mock dependency and dev:mock here
        ├── package-lock.json
        ├── vite.config.ts                            # Add the plugin and SDK aliases here
        └── src/
```

In the instructions below:

- **Salesforce DX project root** means `MySalesforceProject/`, the folder containing `sfdx-project.json`.
- **UI Bundle app folder** means `MySalesforceProject/force-app/main/default/uiBundles/MyReactApp/`, the folder containing the React app's `package.json` and `vite.config.ts`.
- Run `sf` project and deployment commands from the Salesforce DX project root.
- Run every `npm` command in this guide from the UI Bundle app folder.
- Edit only the UI Bundle app's `package.json`; leave the Salesforce DX root `package.json` unchanged.

## Installation

First change from the Salesforce DX project root into the UI Bundle app folder:

```bash
cd force-app/main/default/uiBundles/MyReactApp
```

Confirm that you are in the correct folder before installing anything:

```bash
pwd
ls package.json vite.config.ts
```

The displayed path must end in `uiBundles/MyReactApp`, and both files must exist. Do not run the following commands from `MySalesforceProject/`, even though that folder also contains a `package.json`.

From the UI Bundle app folder, install the React app dependencies and then the mock package:

```bash
npm install
npm install -D github:dreaminforce/salesforce-sdk-data-mock
```

## Update the UI Bundle `package.json`

Open `force-app/main/default/uiBundles/MyReactApp/package.json`—not the root `MySalesforceProject/package.json`—and add a separate mock script:

```json
{
  "scripts": {
    "dev": "vite",
    "dev:mock": "vite --mode mock"
  }
}
```

Keep the existing `dev` script. The mock script is only for local mock mode.

## Update the UI Bundle Vite Configuration

Update `force-app/main/default/uiBundles/MyReactApp/vite.config.ts`. Do not replace the whole file; add the mock pieces to the existing config.

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
  // keep existing plugins here
  ...(isMockMode ? [salesforceMockDataPlugin()] : []),
],
```

### Add the SDK Aliases and Convert Every Existing Alias

The generated `reactbasic` Vite configuration represents `resolve.alias` as an object. The mock uses regular expressions for exact SDK matching, so you must convert the **entire** `alias` value to Vite's array form.

This means changing the outer `alias: { ... }` to `alias: [ ... ]` and converting **every existing generated alias** from this object form:

```ts
"@": path.resolve(__dirname, "./src")
```

to this array-entry form:

```ts
{ find: "@", replacement: path.resolve(__dirname, "./src") }
```

Do not spread the mock alias array inside the generated alias object. That creates numeric object properties that Vite does not recognize as aliases.

Replace the complete generated `resolve` section with this working configuration:

```ts
resolve: {
  dedupe: ["react", "react-dom"],
  alias: [
    ...(isMockMode
      ? [
          {
            find: /^@salesforce\/platform-sdk\/data$/,
            replacement: "salesforce-sdk-data-mock",
          },
          {
            find: /^@salesforce\/platform-sdk$/,
            replacement: "salesforce-sdk-data-mock",
          },
        ]
      : []),

    { find: "@", replacement: path.resolve(__dirname, "./src") },
    { find: "@api", replacement: path.resolve(__dirname, "./src/api") },
    {
      find: "@components",
      replacement: path.resolve(__dirname, "./src/components"),
    },
    { find: "@utils", replacement: path.resolve(__dirname, "./src/utils") },
    { find: "@styles", replacement: path.resolve(__dirname, "./src/styles") },
    { find: "@assets", replacement: path.resolve(__dirname, "./src/assets") },
  ],
},
```

The first exact-match entry supports the Data SDK subpath recommended in the Salesforce documentation. The second supports generated applications that import the Data SDK from the package root. Exact matching prevents the mock from intercepting unrelated Platform SDK modules such as `@salesforce/platform-sdk/chat`.

These aliases make existing Salesforce Data SDK imports resolve to the mock package in `dev:mock` without affecting normal `npm run dev` behavior.

The generated `src/api/graphqlClient.ts` imports `createDataSDK` from the package root. No source change is required because the configuration aliases both supported Data SDK import forms.

## GA Data SDK Usage

Your application uses the same interface in real and mock modes:

```ts
import { createDataSDK, gql } from "@salesforce/platform-sdk/data";

const dataSdk = await createDataSDK();
const result = await dataSdk.graphql?.query({
  query: gql`
    query Accounts {
      uiapi {
        query {
          Account {
            nodes {
              Id
              Name {
                value
              }
            }
          }
        }
      }
    }
  `,
});

const accounts = result?.data?.uiapi?.query?.Account?.nodes ?? [];
```

Mock query results also expose `subscribe(callback)` and `refresh()`. Calling `refresh()` reruns the operation against the latest local fixtures and notifies active subscribers.

## Running the App

Run these commands from the UI Bundle app folder—the same folder containing `vite.config.ts`.

Run with mock Salesforce data:

```bash
npm run dev:mock
```

Run with the real Salesforce SDK:

```bash
npm run dev
```

Before starting mock mode, verify that the generated project still builds and lints:

```bash
npm run build
npm run lint
npm run dev:mock
```

The generated Salesforce Vite plugin can print `No default org found` when no org is authenticated. In mock mode, this warning is expected and does not prevent the local app or `/mock-data` from working.

To confirm the integration:

1. Open the Vite URL and run a Data SDK query from the application.
2. Confirm that the query returns the built-in mock records.
3. Open `http://localhost:<your-vite-port>/mock-data` and confirm that the editable object tables load.

## `/mock-data` Data Screen

When the Vite plugin is enabled, the package adds a local data-management screen:

```txt
http://localhost:<your-vite-port>/mock-data
```

Use this screen to manage mock Salesforce records without editing source code. It shows each object in an editable datatable, so you can view and update the data your app receives from the Salesforce Data SDK in mock mode.

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
force-app/main/default/uiBundles/MyReactApp/mock-data/Account.csv
force-app/main/default/uiBundles/MyReactApp/mock-data/Contact.csv
force-app/main/default/uiBundles/MyReactApp/mock-data/Invoice__c.csv
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
import { setSalesforceMockObjectFixtures } from "salesforce-sdk-data-mock";

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
import { addSalesforceMockGraphQLOverride } from "salesforce-sdk-data-mock";

addSalesforceMockGraphQLOverride(({ operationType, operationName }) => {
  if (operationType !== "query") return undefined;
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

The same override mechanism handles mutations. Generic mutation execution is intentionally unsupported, so register an override for each mutation used by your local application:

```ts
addSalesforceMockGraphQLOverride(({ operationType, operationName, variables }) => {
  if (operationType !== "mutation" || operationName !== "UpdateAccount") {
    return undefined;
  }

  return {
    data: {
      uiapi: {
        AccountUpdate: {
          Record: { Id: variables.id },
        },
      },
    },
  };
});
```

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

You are probably in the Salesforce DX project root, or the script was added to its `package.json`. Change into `force-app/main/default/uiBundles/MyReactApp` and confirm that its `package.json` contains `dev:mock`.

### The app still calls the real Salesforce SDK

Check that:

- You started the app with `npm run dev:mock`
- `const isMockMode = mode === "mock"` is inside `defineConfig`
- The `@salesforce/platform-sdk/data` and `@salesforce/platform-sdk` aliases are inside `resolve.alias`
- Existing aliases were preserved

### `/mock-data` does not open

Check that:

- `salesforceMockDataPlugin()` is included in the Vite `plugins` array
- The app was started with `npm run dev:mock`
- You are using the Vite port shown by Vite

## Limitations

This is not a full Salesforce GraphQL server. It does not enforce org schema validation, field-level security, sharing, generic mutation execution, or exact Salesforce null ordering behavior. Mutations can be mocked with operation overrides.

## Maintenance Checks

This package has a small dependency tree:

- production dependency: `graphql`
- development dependency: `typescript`
- optional peer dependency: `@salesforce/platform-sdk` (`>=10.24.0 <12`)
- optional peer dependency: `vite`

To rerun local checks:

```bash
npm install
npm audit --omit=dev
npm audit
npm pack --dry-run
```
