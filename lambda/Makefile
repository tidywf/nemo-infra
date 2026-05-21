IMAGE   := tidywigits-lambda
VERSION := 0.0.7.9003
PORT    := 9000

S3_INPUT  ?= s3://umccr-temp-dev/diakumis/tidywigits/inputs/oncoanalyser-wgts-dna/202509103c7b1a3b/L2300943__L2300950/
S3_OUTPUT_BUCKET ?= umccr-temp-dev
SAMPLE_ID ?= L2300943__L2300950

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
	  -e S3_OUTPUT_BUCKET=$(S3_OUTPUT_BUCKET) \
	  $(IMAGE):$(VERSION) \
	  python3 -m awslambdaric handler.handler

invoke:
	curl -s -XPOST "http://localhost:$(PORT)/2015-03-31/functions/function/invocations" \
	  -H "Content-Type: application/json" \
	  -d '{"detail": {"sample_id": "$(SAMPLE_ID)", "s3_path": "$(S3_INPUT)"}}'

logs:
	docker logs lambda-test

stop:
	docker rm -f lambda-test

test: start invoke

.PHONY: build start invoke logs stop test
