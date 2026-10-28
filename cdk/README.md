# cdk

AWS CDK app (TypeScript) that defines the nemo Lambda infrastructure.

## Files

- `bin/app.ts`: CDK entrypoint. Reads config from `cdk.json` via `getContext` and
  instantiates `NemoStack`.

- `cdk.json`: CDK config. The `app` field tells CDK how to run the entrypoint. The `context`
  block holds all deployment parameters (bucket names, per-workflow settings, image tag,
  memory, `/tmp` size).

- `helpers/parameters.ts`: typed wrapper around `cdk.json`. `getContext()` reads the raw
  context values via CDK's API and returns them as a `NemoContext` object, giving the
  stack code type safety and autocomplete instead of scattered `getContext()` calls with bare
  strings. It also checks that `nemoWorkflow` is a `workflows` key.

- `lib/NemoStack.ts`: the single active stack: imported ECR repo and S3 buckets, IAM
  role, Lambda, one EventBridge rule per workflow, IAM-auth API Gateway, and the
  `LambdaFunctionName` / `ApiGatewayUrl` outputs. See `docs/architecture.md` for
  details.

## Configuration

All values live in `cdk.json` under `context`; nothing is hardcoded in the stack:

| Key | Default | Description |
|-----|---------|-------------|
| `s3InputBucketName` | _(required)_ | S3 bucket containing the pipeline outputs |
| `s3OutputBucketName` | _(required)_ | S3 bucket for Parquet results |
| `workflows` | _(required)_ | Map of nemo workflow name → `{detailType, s3InputPrefix, s3OutputPrefix}`: the EventBridge `detail-type` that triggers it, and its key prefixes within the input and output buckets |
| `nemoWorkflow` | `wigits` | Workflow run when the event names none (e.g. API Gateway); must be a `workflows` key |
| `imageTag` | `latest` | nemo Lambda container image tag in ECR (mirrors the `nemo-image` base tag) |
| `lambdaMemoryMB` | `6144` | Lambda memory in MB |
| `lambdaEphemeralStorageMB` | `10240` | Lambda `/tmp` size in MB (512–10240); holds both inputs and outputs |

`wigits` and `dragen` are configured. Adding a workflow = a new `workflows` entry; the
deploy adds a matching rule. `lambda/Makefile` `NEMO_WORKFLOWS` mirrors this map by
hand for local testing.

## Commands

Run from this directory (`cdk/`):

```shell
# preview the CloudFormation template without deploying
npx cdk synth

# diff against what is currently deployed
npx cdk diff

# deploy the stack
npx cdk deploy
```

## Deployment

The stack **imports** the `nemo-lambda` ECR repo, so the repo must exist and hold the
`imageTag` image before the first deploy. Full order is in the top-level `README.md`.
