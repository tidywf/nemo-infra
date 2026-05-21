import os
import subprocess
import tempfile

from sync import s3_sync_down, s3_sync_up


def handler(event, context):
    sample_id = event['detail']['sample_id']
    s3_path = event['detail']['s3_path']
    output_bucket = os.environ['S3_OUTPUT_BUCKET']

    print(f"Processing sample: {sample_id}")
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
                '--input_id', sample_id,
                '--prefix_include',
                '--ulid',
                '--format', 'parquet',
            ],
            check=True,
        )

        s3_out = f"s3://{output_bucket}/{sample_id}/"
        print(f"Syncing outputs to {s3_out}")
        s3_sync_up(out_dir, s3_out)

    return {'status': 'ok', 'sample_id': sample_id}
