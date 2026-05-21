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
  -e S3_OUTPUT_BUCKET=test-bucket \
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
  -d '{"detail": {"sample_id": "TEST001", "s3_path": "s3://test-input/TEST001/"}}'
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
