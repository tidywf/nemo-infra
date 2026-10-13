# nemo infrastructure

AWS infrastructure for running [nemo](https://github.com/umccr/nemo) tidy jobs as a
container Lambda. An EventBridge event (e.g. `WigitsRunCompleted`) triggers the Lambda,
which syncs the run's parse-relevant files from S3, runs `nemo.R tidy`, and writes
Parquet results back to S3. An IAM-authenticated API Gateway POST endpoint is kept for
manual runs.

## Layout

| Path      | What                                                                    |
| --------- | ----------------------------------------------------------------------- |
| `cdk/`    | CDK app (TypeScript) defining `NemoStack`; config in `cdk/cdk.json`     |
| `lambda/` | Lambda container (`Dockerfile`, `handler.py`) and local test `Makefile` |
| `docs/`   | Architecture, general CDK notes                                         |

## Deploy

1. Build the image (`linux/amd64`) and push it to the `nemo-lambda` ECR repo under
   the `imageTag` in `cdk/cdk.json`. The stack imports the repo, so it must exist
   first. See [lambda/README.md](lambda/README.md#build-and-push-to-ecr).
2. `cd cdk && npx cdk diff && npx cdk deploy`. See [cdk/README.md](cdk/README.md).
3. Test with a signed POST to the `ApiGatewayUrl` stack output (`awscurl`), then
   confirm the EventBridge rule fires once the pipeline emits its event. See
   [lambda/README.md](lambda/README.md#invoke).

## Docs

- [docs/architecture.md](docs/architecture.md): diagram, event payload, stack and
  handler design
- [docs/cdk-notes.md](docs/cdk-notes.md): general CDK concepts, commands and tips
- [cdk/README.md](cdk/README.md): CDK files, `cdk.json` configuration, commands
- [lambda/README.md](lambda/README.md): container, env vars, build/push, invoke, logs,
  local RIE smoke test
