import json
import os
import subprocess
import tempfile

from ulid import ULID

# Per-workflow config (`detailType`, `s3InputPrefix`, `s3OutputPrefix`), keyed
# by nemo workflow name; mirrors the `workflows` context in cdk.json. Download
# filters are not kept here: `nemo.R sync` derives them from the workflow's own
# tool schemas.
WORKFLOWS = json.loads(os.environ['NEMO_WORKFLOWS'])
# fallback when the event names no workflow (e.g. API Gateway, local RIE)
DEFAULT_WORKFLOW = os.environ.get('NEMO_WORKFLOW', 'wigits')


def resolve_workflow(event):
    """`detail.workflow` => workflow owning `detail-type` => default."""
    workflow = event['detail'].get('workflow')
    if workflow is None:
        detail_type = event.get('detail-type')
        workflow = next(
            (wf for wf, cfg in WORKFLOWS.items() if cfg['detailType'] == detail_type),
            DEFAULT_WORKFLOW,
        )
    if workflow not in WORKFLOWS:
        raise ValueError(
            f"Workflow '{workflow}' not configured; known: {sorted(WORKFLOWS)}"
        )
    return workflow


def handler(event, context):
    input_id = event['detail']['input_id']
    workflow = resolve_workflow(event)
    input_bucket = os.environ['S3_INPUT_BUCKET']
    input_prefix = WORKFLOWS[workflow]['s3InputPrefix']
    output_bucket = os.environ['S3_OUTPUT_BUCKET']
    output_prefix = WORKFLOWS[workflow]['s3OutputPrefix']
    # generated here so the output path is known before the run
    output_id = str(ULID())

    s3_path = f"s3://{input_bucket}/{input_prefix}/{input_id}/"
    print(f"Processing input: {input_id}")
    print(f"S3 input path: {s3_path}")
    print(f"Workflow: {workflow}")
    print(f"Output ID: {output_id}")

    with tempfile.TemporaryDirectory() as tmpdir:
        in_dir = f"{tmpdir}/input"
        out_dir = f"{tmpdir}/output"
        os.makedirs(in_dir)
        os.makedirs(out_dir)

        print(f"Running nemo sync --workflow {workflow}")
        subprocess.run(
            [
                'nemo.R', 'sync',
                '--workflow', workflow,
                '--src', s3_path,
                '--dest', in_dir,
            ],
            check=True,
        )

        print(f"Running nemo tidy --workflow {workflow}")
        subprocess.run(
            [
                'nemo.R', 'tidy',
                '--workflow', workflow,
                '--in_dir', in_dir,
                '--output_dir', out_dir,
                '--input_id', input_id,
                '--output_id', output_id,
                '--prefix_include',
                '--format', 'parquet',
            ],
            check=True,
        )

        s3_out = f"s3://{output_bucket}/{output_prefix}/{output_id}/"
        print(f"Syncing outputs to {s3_out}")
        # upload is unfiltered: everything nemo wrote to out_dir goes up
        subprocess.run(['aws', 's3', 'sync', out_dir, s3_out], check=True)

    return {
        'status': 'ok',
        'input_id': input_id,
        'output_id': output_id,
        'workflow': workflow,
    }
