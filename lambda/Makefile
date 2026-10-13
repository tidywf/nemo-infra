IMAGE   := nemo-lambda
VERSION := 0.0.0.9004
PORT    := 9000

S3_INPUT_BUCKET  ?= umccr-temp-dev
# mirrors the `workflows` context in cdk/cdk.json
NEMO_WORKFLOWS   ?= {"wigits": {"detailType": "WigitsRunCompleted", "s3InputPrefix": "diakumis/tidywigits/inputs/oncoanalyser-wgts-dna", "s3OutputPrefix": "diakumis/tidywigits/outputs"}, "dragen": {"detailType": "DragenRunCompleted", "s3InputPrefix": "diakumis/tidydragen/inputs/dragen-wgts-dna", "s3OutputPrefix": "diakumis/tidydragen/outputs"}}
S3_OUTPUT_BUCKET ?= umccr-temp-dev
NEMO_WORKFLOW    ?= wigits
INPUT_ID         ?= 202509103c7b1a3b
# workflow named in the event; e.g. `make invoke WORKFLOW=dragen INPUT_ID=20260930fecb5400`
WORKFLOW         ?= $(NEMO_WORKFLOW)

build:
	docker build --platform linux/amd64 --provenance=false --sbom=false -t $(IMAGE):$(VERSION) .

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
	  -e NEMO_WORKFLOWS='$(NEMO_WORKFLOWS)' \
	  -e S3_OUTPUT_BUCKET=$(S3_OUTPUT_BUCKET) \
	  -e NEMO_WORKFLOW=$(NEMO_WORKFLOW) \
	  $(IMAGE):$(VERSION) \
	  python3 -m awslambdaric handler.handler

invoke:
	curl -s -XPOST "http://localhost:$(PORT)/2015-03-31/functions/function/invocations" \
	  -H "Content-Type: application/json" \
	  -d '{"detail": {"input_id": "$(INPUT_ID)", "workflow": "$(WORKFLOW)"}}'

logs:
	docker logs lambda-test

stop:
	docker rm -f lambda-test

# wait for the RIE to accept connections before invoking
test: start
	@until curl -s -o /dev/null "http://localhost:$(PORT)"; do sleep 1; done
	@$(MAKE) invoke

.PHONY: build start invoke logs stop test
