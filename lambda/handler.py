import json
import os
import subprocess
import tempfile

from sync import s3_sync_down, s3_sync_up


def handler(event, context):
    payload = json.loads(event['body']) if 'body' in event else event
    input_id = payload['detail']['input_id']
    input_bucket = os.environ['S3_INPUT_BUCKET']
    input_prefix = os.environ['S3_INPUT_PREFIX']
    output_bucket = os.environ['S3_OUTPUT_BUCKET']
    output_prefix = os.environ['S3_OUTPUT_PREFIX']

    s3_path = f"s3://{input_bucket}/{input_prefix}/{input_id}/"
    print(f"Processing input: {input_id}")
    print(f"S3 input path: {s3_path}")

    with tempfile.TemporaryDirectory() as tmpdir:
        in_dir = f"{tmpdir}/input"
        out_dir = f"{tmpdir}/output"
        os.makedirs(in_dir)
        os.makedirs(out_dir)

        print(f"Syncing inputs from {s3_path} to {in_dir}")
        s3_sync_down(s3_path, in_dir)

        print("Running tidywigits")
        subprocess.run(
            [
                'tidywigits.R', 'tidy',
                '--in_dir', in_dir,
                '--out_dir', out_dir,
                '--input_id', input_id,
                '--prefix_include',
                '--ulid',
                '--format', 'parquet',
            ],
            check=True,
        )

        metadata_path = f"{out_dir}/_metadata/metadata.json"
        with open(metadata_path) as f:
            output_id = json.load(f)['output_id']

        s3_out = f"s3://{output_bucket}/{output_prefix}/{output_id}/"
        print(f"Syncing outputs to {s3_out}")
        s3_sync_up(out_dir, s3_out)

    return {'status': 'ok', 'input_id': input_id, 'output_id': output_id}
