import * as cdk from 'aws-cdk-lib';

export interface TidywigitsContext {
  s3InputBucketName: string;
  s3InputPrefix: string;
  s3OutputBucketName: string;
  s3OutputPrefix: string;
  imageTag: string;
  lambdaMemoryMB: number;
}

export function getContext(app: cdk.App): TidywigitsContext {
  return {
    s3InputBucketName: app.node.getContext('s3InputBucketName'),
    s3InputPrefix: app.node.getContext('s3InputPrefix'),
    s3OutputBucketName: app.node.getContext('s3OutputBucketName'),
    s3OutputPrefix: app.node.getContext('s3OutputPrefix'),
    imageTag: app.node.getContext('imageTag') ?? 'latest',
    lambdaMemoryMB: app.node.getContext('lambdaMemoryMB') ?? 6144,
  };
}
