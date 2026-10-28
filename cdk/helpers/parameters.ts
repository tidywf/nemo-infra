import * as cdk from 'aws-cdk-lib';

// Per-workflow settings, keyed by nemo workflow name (`wigits`, `dragen`).
export interface NemoWorkflowConfig {
  // EventBridge `detail-type` that triggers this workflow
  detailType: string;
  // key prefix within the input bucket holding this workflow's run outputs
  s3InputPrefix: string;
  // key prefix within the output bucket that this workflow's outputs go under
  s3OutputPrefix: string;
}

export interface NemoContext {
  s3InputBucketName: string;
  s3OutputBucketName: string;
  imageTag: string;
  lambdaMemoryMB: number;
  lambdaEphemeralStorageMB: number;
  workflows: Record<string, NemoWorkflowConfig>;
  nemoWorkflow: string;
}

export function getContext(app: cdk.App): NemoContext {
  const ctx: NemoContext = {
    s3InputBucketName: app.node.getContext('s3InputBucketName'),
    s3OutputBucketName: app.node.getContext('s3OutputBucketName'),
    imageTag: app.node.tryGetContext('imageTag') ?? 'latest',
    lambdaMemoryMB: app.node.tryGetContext('lambdaMemoryMB') ?? 6144,
    lambdaEphemeralStorageMB: app.node.tryGetContext('lambdaEphemeralStorageMB') ?? 10240,
    workflows: app.node.getContext('workflows'),
    nemoWorkflow: app.node.tryGetContext('nemoWorkflow') ?? 'wigits',
  };
  if (!(ctx.nemoWorkflow in ctx.workflows)) {
    throw new Error(
      `nemoWorkflow '${ctx.nemoWorkflow}' has no entry in the 'workflows' context`,
    );
  }
  return ctx;
}
