IMAGE   := tidywigits-lambda
VERSION := 0.0.7.9003
PORT    := 9000

S3_INPUT_BUCKET  ?= umccr-temp-dev
S3_INPUT_PREFIX  ?= diakumis/tidywigits/inputs/oncoanalyser-wgts-dna
S3_OUTPUT_BUCKET ?= umccr-temp-dev
S3_OUTPUT_PREFIX ?= diakumis/tidywigits/outputs
INPUT_ID         ?= 202509103c7b1a3b

build:
	docker build --platform linux/amd64 -t $(IMAGE):$(VERSION) .

start:
	docker run -d \
	  --platform linux/amd64 \
	  --name lambda-test \
	  -v ~/.aws-lambda-rie:/aws-lambda \
	  -p $(PORT):8080 \
	  --entrypoint /aws-lambda/aws-lambda-rie \
	  -e AWS_ACCESS_KEY_ID \
	  -e AWS_SECRET_ACCESS_KEY \
	  -e AWS_SESSION_TOKEN \
	  -e AWS_DEFAULT_REGION \
	  -e S3_INPUT_BUCKET=$(S3_INPUT_BUCKET) \
	  -e S3_INPUT_PREFIX=$(S3_INPUT_PREFIX) \
	  -e S3_OUTPUT_BUCKET=$(S3_OUTPUT_BUCKET) \
	  -e S3_OUTPUT_PREFIX=$(S3_OUTPUT_PREFIX) \
	  $(IMAGE):$(VERSION) \
	  python3 -m awslambdaric handler.handler

invoke:
	curl -s -XPOST "http://localhost:$(PORT)/2015-03-31/functions/function/invocations" \
	  -H "Content-Type: application/json" \
	  -d '{"detail": {"input_id": "$(INPUT_ID)"}}'

logs:
	docker logs lambda-test

stop:
	docker rm -f lambda-test

test: start invoke

.PHONY: build start invoke logs stop test
