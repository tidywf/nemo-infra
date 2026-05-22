# cdk

AWS CDK app (TypeScript) that defines the tidywigits infrastructure.

## Files

- `bin/app.ts`: CDK entrypoint. Reads config from `cdk.json` via `getContext` and
  instantiates `TidywigitsStack`.

- `cdk.json`: CDK config. The `app` field tells CDK how to run the entrypoint. The `context`
  block holds all deployment parameters (bucket names, image tag, memory).

- `helpers/parameters.ts`: typed wrapper around `cdk.json`. `getContext()` reads the raw
  context values via CDK's API and returns them as a `TidywigitsContext` object, giving the
  stack code type safety and autocomplete instead of scattered `getContext()` calls with bare
  strings.

- `lib/TidywigitsStack.ts`: the single active stack. Defines:
  - ECR repo: where the tidywigits Lambda container image is stored
  - S3 bucket: output bucket for Parquet results
  - IAM role: CloudWatch Logs + S3 read (input bucket) + S3 write (output bucket)
  - Lambda function: container image from ECR, 15 min timeout, configurable memory
  - API Gateway: single POST endpoint for manual invocation

## Configuration

All values live in `cdk.json` under `context`; nothing is hardcoded in the stack:

| Key | Default | Description |
|-----|---------|-------------|
| `s3InputBucketName` | _(required)_ | S3 bucket containing WiGiTS pipeline outputs |
| `s3InputPrefix` | _(required)_ | Key prefix within the input bucket (e.g. `diakumis/tidywigits/inputs/oncoanalyser-wgts-dna`) |
| `s3OutputBucketName` | _(required)_ | S3 bucket for Parquet results |
| `s3OutputPrefix` | _(required)_ | Key prefix within the output bucket (e.g. `diakumis/tidywigits/outputs`) |
| `imageTag` | `latest` | tidywigits container image tag in ECR |
| `lambdaMemoryMB` | `6144` | Lambda memory in MB |

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

## Deployment order

CDK creates the ECR repo; you cannot push the container image until after the first deploy.

1. `npx cdk deploy`: creates all resources; note the ECR repo URI in the stack outputs
2. Tag and push the local image to ECR
3. Test via API Gateway POST
