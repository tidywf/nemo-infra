# Plan

## Goal

Run dockerised nemo as a container Lambda, triggered by an EventBridge event when a
WiGiTS (or DRAGEN) workflow run completes, writing Parquet results to S3. Design and
stack details are in `architecture.md`.

## TODO

- [x] Fill in real bucket names in `cdk/cdk.json`
- [x] Run `cdk synth` and review the generated CloudFormation template
- [x] Bootstrap CDK (`CDKToolkit` stack already present in dev account)
- [x] Confirm `nemo.R tidy` CLI flags and update `lambda/handler.py`
- [x] Build and smoke-test the Lambda Docker image locally (RIE + real S3 data)
- [x] Deploy the stack (`npx cdk deploy` from `cdk/`) — as `TidywigitsStack`;
      renamed to `NemoStack`, needs redeploying
- [x] Push container image to ECR and test end-to-end via API Gateway POST
- [x] Bump base to `nemo-image:0.0.0.9004` (ships `nemo.R sync`)
- [x] Create the `nemo-lambda` ECR repo, build `linux/amd64`, push `0.0.0.9004`
- [x] Add a `dragen` entry to `workflows` (prefixes under `diakumis/tidydragen/`)
- [x] Lock down the API Gateway endpoint with IAM auth (Security Hub finding)
- [ ] Rebuild + re-push `0.0.0.9004` (handler no longer unwraps `body`)
- [ ] Deploy `NemoStack`, test via a signed POST to its new `ApiGatewayUrl`
- [ ] Delete the old `TidywigitsStack` once `NemoStack` is confirmed working
- [ ] Confirm the WiGiTS pipeline emits `WigitsRunCompleted` (rule fires)
- [ ] Confirm the real DRAGEN `detail-type`
- [ ] Add an `onFailure` SQS destination to the Lambda (failed async runs are
      otherwise only visible in logs, since `retryAttempts: 0`)
- [ ] Set `logRetention` on the Lambda log group (default: never expire)
