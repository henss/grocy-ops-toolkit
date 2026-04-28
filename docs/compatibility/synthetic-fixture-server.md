# Synthetic Grocy Fixture Server

This server is a local read-only HTTP wrapper around the repo's synthetic Grocy API fixtures. It is intended for integration prototyping, CLI development, and adapter checks that need a stable Grocy-like base URL without live credentials or private data.

The server serves only synthetic responses for the toolkit's current read surfaces:

- `/api/system/info`
- `/api/stock`
- `/api/objects/products`
- `/api/objects/product_groups`
- `/api/objects/locations`
- `/api/objects/quantity_units`
- `/api/objects/product_barcodes`
- `/api/objects/shopping_lists`
- `/api/objects/shopping_list`

Start the default fixture:

```bash
npm run grocy:fixtures:serve
```

The default address is:

```text
http://127.0.0.1:4010/api
```

Select a different synthetic API shape:

```bash
npm run grocy:fixtures:serve -- --fixture fixture-minimal-read-api --port 4020
```

Available fixture ids:

- `fixture-current-object-api`
- `fixture-minimal-read-api`
- `fixture-shopping-list-gap`

The command prints a JSON startup record that includes the resolved `baseUrl`, selected `fixtureId`, and the supported path list. Visiting the server root `/` returns the same manifest as JSON so tooling can discover the active fixture set.

The server is intentionally constrained:

- It only accepts `GET` requests.
- It returns `405` for write attempts.
- It returns `404` for unsupported endpoints.
- It does not proxy live Grocy traffic.
- It does not include household data, shopping intent workflows, calendar/task integrations, or personal operating policy.
