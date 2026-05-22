# lambda

Lambda container for running nemo-related jobs.

## Files

- `handler.py`: Lambda entrypoint. Exports `handler` function that receives the event,
  extracts required fields, then calls `tidywigits.R tidy`.
- `sync.py`: for syncing data to and from S3, within the Lambda.
- `Dockerfile`: installs `awslambdaric` (Python Lambda Runtime Interface Client)
  on top of the tidywigits base image conda env, copies in `handler.py` + `sync.py`, and sets
  `python3 -m awslambdaric` as the entrypoint. `pip` resolves to the available conda env's own pip.
  - `awslambdaric` is what makes a plain Python container work as
    a Lambda. It implements the Lambda Runtime API polling loop that AWS manages automatically in
    managed runtimes. Without it, Lambda has no way to invoke the handler function.

## Image build

```shell
docker build \
  --platform linux/amd64 \
  -t tidywigits-lambda:0.0.7.9003 .
```

## Push to ECR

```shell
ECR=843407916570.dkr.ecr.ap-southeast-2.amazonaws.com
REPO=tidywigits-lambda
VERSION=0.0.7.9003

# Authenticate
aws ecr get-login-password --region ap-southeast-2 \
  | docker login --username AWS --password-stdin $ECR

# Tag and push
docker tag $REPO:$VERSION $ECR/$REPO:$VERSION
docker push $ECR/$REPO:$VERSION

# Update Lambda to pick up the new image digest (required even if the tag hasn't changed)
aws lambda update-function-code \
  --function-name TidywigitsStack-TidywigitsFunction0F66A7D8-mmyNnhRZApDk \
  --image-uri $ECR/$REPO:$VERSION \
  --region ap-southeast-2
```

## Smoke test with RIE

The [Lambda Runtime Interface Emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator)
(RIE) is a lightweight local web server that mimics the AWS Lambda Runtime API
(which AWS uses internally to invoke the function).
Running the container with the RIE mounted stands in for AWS, as it boots the container,
starts the `awslambdaric` polling loop, then listens on port 8080 (mapped to 9000 on the host)
for incoming invocation requests.

- Install the RIE binary:

```shell
mkdir -p ~/.aws-lambda-rie
curl -Lo ~/.aws-lambda-rie/aws-lambda-rie \
  https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie-x86_64
chmod +x ~/.aws-lambda-rie/aws-lambda-rie
```

- Start the container:

```shell
docker run -d \
  --platform linux/amd64 \
  --name lambda-test \
  -v ~/.aws-lambda-rie:/aws-lambda \
  -p 9000:8080 \
  --entrypoint /aws-lambda/aws-lambda-rie \
  -e S3_INPUT_BUCKET=umccr-temp-dev \
  -e S3_INPUT_PREFIX=diakumis/tidywigits/inputs/oncoanalyser-wgts-dna \
  -e S3_OUTPUT_BUCKET=umccr-temp-dev \
  -e S3_OUTPUT_PREFIX=diakumis/tidywigits/outputs \
  tidywigits-lambda:0.0.7.9003 \
  python3 -m awslambdaric handler.handler
```

- Send mock event:

`POST /2015-03-31/functions/function/invocations` is the RIE's
standard endpoint for triggering an invocation. You send it a JSON payload and it passes that to
your handler as the event argument, just like AWS would.

```shell
curl -s -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H "Content-Type: application/json" \
  -d '{"detail": {"input_id": "TEST001"}}'
```

- Clean up:

```shell
docker rm lambda-test
```

All together via Makefile:

```
make build
make start
make invoke
make stop
```

## Invoke

Via API Gateway (returns 202 immediately, Lambda runs async):

```shell
curl -s -XPOST "https://7xv9bhxwwk.execute-api.ap-southeast-2.amazonaws.com/prod/" \
  -H "Content-Type: application/json" \
  -d '{"detail": {"input_id": "202509103c7b1a3b"}}'
```

Via CLI (also async):

```shell
aws lambda invoke \
  --function-name TidywigitsStack-TidywigitsFunction0F66A7D8-mmyNnhRZApDk \
  --invocation-type Event \
  --payload '{"detail": {"input_id": "202509103c7b1a3b"}}' \
  --cli-binary-format raw-in-base64-out \
  --region ap-southeast-2 \
  response.json
```

## Logs

```shell
aws logs tail /aws/lambda/TidywigitsStack-TidywigitsFunction0F66A7D8-mmyNnhRZApDk \
  --region ap-southeast-2 \
  --follow
```

