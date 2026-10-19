# CLAUDE.md — nemo-infra

AWS infrastructure for running nemo tidy jobs as a container Lambda, triggered by an
EventBridge event (one rule per workflow: `WigitsRunCompleted`, `DragenRunCompleted`)
with an IAM-auth API Gateway kept as a manual test escape hatch. Open work lives in
`.claude/TODO.md`. For broader ecosystem context see `tidywf/CLAUDE.md` (auto-loaded when
Claude Code is started from the parent dir).

## Repo structure

```
nemo-infra/
├── README.md                   # Overview, layout, deploy order, doc index
├── .node-version               # Node 26.11.1 (fnm) for the CDK tooling
├── .claude/
│   ├── CLAUDE.md
│   └── TODO.md                 # The only TODO list — keep it here, not in docs/
├── cdk/                        # CDK app (TypeScript); README: files, cdk.json config
│   ├── bin/app.ts              # CDK entrypoint
│   ├── lib/NemoStack.ts        # Single stack: ECR + S3 + Lambda + EventBridge rules + API GW
│   ├── helpers/parameters.ts   # NemoContext interface + getContext()
│   ├── cdk.json                # CDK context (buckets, workflows, image tag, memory, /tmp)
│   └── package.json            # aws-cdk-lib, aws-cdk CLI, ts-node, typescript
├── lambda/                     # Lambda container; README: build/push, invoke, logs, RIE
│   ├── Dockerfile              # Extends nemo-image; installs awslambdaric + awscli + python-ulid
│   ├── handler.py              # Receives event, runs nemo.R sync + tidy, syncs outputs back
│   └── Makefile                # build / start / invoke / logs / stop / test (local RIE)
└── docs/
    └── architecture.md         # Diagram, event payload, stack + handler design
```

Docs are deliberately non-overlapping: design → `docs/architecture.md`, deploy order →
`README.md`, config → `cdk/README.md`, how-to commands → `lambda/README.md`, TODO →
`.claude/TODO.md`.

## NemoStack

Single stack — no VPC, no database dependency.

- ECR: `nemo-lambda`, imported (not created) — holds the Lambda container image
- S3: input and output buckets, both imported by name
- Lambda: container image from ECR; 15 min timeout; configurable memory (default 6 GB)
  and `/tmp` (default 10 GB); `retryAttempts: 0` (a retry would mint a new output_id)
- IAM: CloudWatch Logs + S3 read (input bucket) + S3 write/list (output bucket)
- EventBridge: one rule per `workflows` entry in `cdk.json`, on the default bus, matching
  its `detailType` and invoking the Lambda directly — primary trigger. Rule ids are
  `<detailType>Rule`
- API Gateway: single POST endpoint for manual invocation (returns 202, Lambda runs async);
  IAM auth (`AuthorizationType.IAM`) after a Security Hub "unauthorized access" finding
  on the old open endpoint — call it with `awscurl --service execute-api`.
  `cloudWatchRole: false`, so no account-wide `AWS::ApiGateway::Account` resource

## Lambda container

`lambda/Dockerfile` extends `nemo-image` (the composite nemo + tidywigits + tidydragen
conda env image) with `awslambdaric`, `awscli` and `python-ulid`, installed via the
env's own pip:

```
FROM ghcr.io/tidywf/nemo-image:0.0.0.9004
  → pip install awslambdaric awscli python-ulid
  → COPY handler.py
  → ENTRYPOINT: python3 -m awslambdaric
  → CMD: handler.handler
```

`lambda/handler.py` receives the event, resolves the workflow, constructs the S3 input
path from `S3_INPUT_BUCKET` + the workflow's `s3InputPrefix` (from `NEMO_WORKFLOWS`) +
`input_id`, generates a ULID as `output_id`,
syncs inputs to a temp dir, runs `nemo.R tidy`, then syncs Parquet outputs back to
`S3_OUTPUT_BUCKET` + the workflow's `s3OutputPrefix` + `output_id`:

```
nemo.R tidy \
  --workflow   wigits \
  --in_dir     <tmp>/input \
  --output_dir <tmp>/output \
  --input_id   <input_id> \
  --output_id  <ulid> \
  --prefix_include \
  --format     parquet
```

Input download is `nemo.R sync`, which builds its `aws s3 sync` include/exclude
patterns from the workflow's own `schema.yaml` files (`nemo::wf_sync_patterns()`),
so only parse-relevant files land in the Lambda's `/tmp` — no BAMs. There is no
pattern list in this repo to keep in step with the parsers:

```
nemo.R sync --workflow <workflow> --src <s3 path> --dest <tmp>/input
```

`nemo.R sync --show_patterns` prints the include/exclude list without syncing,
which is the quickest way to check what a workflow will pull down.

## Key gotchas

- **Workflow selection**: `detail.workflow`, else the workflow whose `detailType`
  matches the event's `detail-type`, else `NEMO_WORKFLOW` (`nemoWorkflow` in
  `cdk.json`, default `wigits`). Per-workflow settings live in the `workflows` context
  map (passed to the Lambda as `NEMO_WORKFLOWS` JSON): `wigits` and `dragen`. Adding
  a workflow = a new entry with its `detailType` + prefixes — sync patterns come from
  nemo, so nothing else in this repo changes. `lambda/Makefile` `NEMO_WORKFLOWS` must
  be kept in step by hand.
- **Event shape**: the handler reads `event['detail']` directly. API Gateway uses a
  non-proxy integration, so the POST body arrives as the event itself — no `body`
  unwrapping.
- **output_id is generated in the handler**, not by nemo's `--ulid`, so the output S3
  path is known before the run. nemo writes `metadata.parquet` at the output
  dir root, and there is no Python parquet reader in the image — don't reintroduce a
  read-back of the generated id.
- **Platform**: `nemo-image` is multi-arch (`linux/amd64` + `linux/arm64`), so a bare
  `docker build` on Apple Silicon silently produces an **arm64** image. The stack does
  not set `architecture`, so the Lambda is `x86_64` and would reject it — always build
  and run with `--platform linux/amd64` (the `lambda/Makefile` targets do).
- **Image manifest**: build with `--provenance=false --sbom=false` (`make build` does).
  Otherwise BuildKit pushes an OCI image index with attestation manifests, which Lambda
  rejects ("image manifest, config or layer media type … is not supported").
- **GHCR auth**: stale Docker credentials for `ghcr.io` cause `denied` errors.
  Run `docker logout ghcr.io` to fall back to anonymous pulls. `nemo-image` may need a
  real login (`gh auth token | docker login ghcr.io -u <user> --password-stdin`).
- **ECR**: Lambda can only pull from ECR — GHCR/Docker Hub are not supported as Lambda
  image sources. The repo (`nemo-lambda`) is **imported** via `fromRepositoryName`, so
  the stack does not create it — it must exist, with the image already pushed, before
  the first deploy.
- **imageTag in cdk.json**: must match the tag pushed to ECR. Currently `0.0.0.9004`,
  mirroring the `nemo-image` base tag.
- **Output bucket ListBucket**: `aws s3 sync` lists the destination before uploading,
  so the role has `s3:ListBucket` on the output bucket as well as `PutObject`.
- **Same-tag image re-push**: the Lambda pins the image digest at deploy time.
  Re-pushing `imageTag` needs `aws lambda update-function-code` (or push before the
  first deploy, which resolves the digest then).
- **Context lookups**: use `tryGetContext()` for optional keys in
  `helpers/parameters.ts` — `getContext()` throws on a missing key, so a `?? default`
  after it never applies.
- **Node / deps**: Node 26 via `.node-version` (fnm). `@types/node` tracks the Node
  major, not npm latest. `typescript` is held at 6: `ts-node` (the `cdk.json` `app`
  runner) relies on the TS compiler API that 7 changed. Check with `npm outdated`.

## Deployment order

See the top-level `README.md`. In short: image in ECR first (the stack imports the
repo), then `npx cdk deploy`, then a signed POST (`awscurl`) to `ApiGatewayUrl`.

## CDK commands

```bash
cd cdk
npx cdk synth       # preview CloudFormation
npx cdk diff        # diff against deployed stack
npx cdk deploy      # deploy NemoStack
```
