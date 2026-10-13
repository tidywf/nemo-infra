# lambda

Lambda container for running nemo tidy jobs.

## Files

- `handler.py`: Lambda entrypoint (`handler.handler`). Reads `detail.input_id`,
  resolves the workflow (`detail.workflow`, else the one whose `detailType` matches the
  event's `detail-type`, else `NEMO_WORKFLOW`), generates a ULID `output_id`, then:
    1. `nemo.R sync`: downloads only the raw files the workflow's `schema.yaml` files parse
    2. `nemo.R tidy --workflow <wf>`: tidies them to Parquet
    3. `aws s3 sync`: uploads the outputs to `s3://<S3_OUTPUT_BUCKET>/<s3OutputPrefix>/<output_id>/`
- `Dockerfile`: extends `nemo-image`, installing `awslambdaric`, `awscli` and
  `python-ulid` with the conda env's own `pip`, and runs `python3 -m awslambdaric`.
  `awslambdaric` (Lambda Runtime Interface Client) implements the Runtime API polling
  loop that managed runtimes provide; without it Lambda cannot invoke the handler.
- `Makefile`: build and local RIE smoke-test targets.

### Environment

| Variable           | Source (deployed)          | Purpose                                                       |
| ------------------ | -------------------------- | ------------------------------------------------------------- |
| `S3_INPUT_BUCKET`  | `s3InputBucketName`        | Input bucket                                                  |
| `S3_OUTPUT_BUCKET` | `s3OutputBucketName`       | Output bucket                                                 |
| `NEMO_WORKFLOWS`   | `workflows` (JSON)         | Per-workflow `detailType`, `s3InputPrefix`, `s3OutputPrefix`  |
| `NEMO_WORKFLOW`    | `nemoWorkflow`             | Fallback workflow (default `wigits`)                          |

All set from `cdk/cdk.json` context.

## Build and push to ECR

Always build for `linux/amd64`: `nemo-image` is multi-arch, so a bare build on Apple
Silicon yields an arm64 image the (x86_64) Lambda rejects.

```shell
ECR=843407916570.dkr.ecr.ap-southeast-2.amazonaws.com
REPO=nemo-lambda   # local image name (Makefile IMAGE) and ECR repo (NemoStack.ts)
VERSION=0.0.0.9004 # must match imageTag in cdk/cdk.json

make build

# one-off: the stack imports the repo, it does not create it
aws ecr create-repository --repository-name $REPO --region ap-southeast-2

aws ecr get-login-password --region ap-southeast-2 \
  | docker login --username AWS --password-stdin $ECR
docker tag $REPO:$VERSION $ECR/$REPO:$VERSION
docker push $ECR/$REPO:$VERSION
```

Then `npx cdk deploy` from `cdk/`.

### Redeploying an image under an existing tag

The Lambda pins the image digest at deploy time, so re-pushing the same tag needs an
explicit update:

```shell
aws lambda update-function-code \
  --function-name $FN \
  --image-uri $ECR/$REPO:$VERSION \
  --region ap-southeast-2
```

## Stack outputs

The function name and API URL are generated and change if the stack or construct is
renamed, so read them from the stack outputs:

```shell
output() {
  aws cloudformation describe-stacks --stack-name NemoStack \
    --region ap-southeast-2 \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}
FN=$(output LambdaFunctionName)
API=$(output ApiGatewayUrl)
```

## Invoke

Both paths are async: API Gateway returns 202, the CLI `Event` invocation returns
immediately. `workflow` is optional (falls back as above).

```shell
PAYLOAD='{"detail": {"input_id": "202509103c7b1a3b", "workflow": "wigits"}}'

# API Gateway
curl -s -XPOST "$API" -H "Content-Type: application/json" -d "$PAYLOAD"

# CLI
aws lambda invoke \
  --function-name $FN \
  --invocation-type Event \
  --payload "$PAYLOAD" \
  --cli-binary-format raw-in-base64-out \
  --region ap-southeast-2 \
  response.json
```

In production the trigger is the EventBridge rule on `WigitsRunCompleted`.

## Logs

```shell
aws logs tail /aws/lambda/$FN --region ap-southeast-2 --follow
```

## Local smoke test (RIE)

The [Lambda Runtime Interface Emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator)
(RIE) is a small local server mimicking the Lambda Runtime API. Mounted into the
container as its entrypoint, it starts the `awslambdaric` loop and listens on port 8080
(mapped to 9000 on the host).

Install once (`x86_64` to match the `linux/amd64` image):

```shell
mkdir -p ~/.aws-lambda-rie
curl -Lo ~/.aws-lambda-rie/aws-lambda-rie \
  https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie-x86_64
chmod +x ~/.aws-lambda-rie/aws-lambda-rie
```

Then, with AWS credentials exported in the shell (passed through for S3 access):

```shell
make build
make start                      # docker run with RIE, env from Makefile defaults
make invoke                     # POST to /2015-03-31/functions/function/invocations
make invoke WORKFLOW=dragen INPUT_ID=<id>
make logs
make stop
```

Override any Makefile variable (`S3_INPUT_BUCKET`, `NEMO_WORKFLOWS`, `INPUT_ID`, …)
on the command line.
