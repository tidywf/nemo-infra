import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { TidywigitsContext } from '../helpers/parameters';

interface TidywigitsStackProps extends cdk.StackProps {
  ctx: TidywigitsContext;
}

export class TidywigitsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TidywigitsStackProps) {
    super(scope, id, props);

    const { ctx } = props;

    const ecrRepo = new ecr.Repository(this, 'TidywigitsRepo', {
      repositoryName: 'tidywigits-lambda',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const outputBucket = new s3.Bucket(this, 'OutputBucket', {
      bucketName: ctx.s3OutputBucketName,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const role = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [
          `arn:aws:s3:::${ctx.s3InputBucketName}`,
          `arn:aws:s3:::${ctx.s3InputBucketName}/*`,
        ],
      }),
    );

    outputBucket.grantPut(role);

    const fn = new lambda.Function(this, 'TidywigitsFunction', {
      code: lambda.Code.fromEcrImage(ecrRepo, { tagOrDigest: ctx.imageTag }),
      handler: lambda.Handler.FROM_IMAGE,
      runtime: lambda.Runtime.FROM_IMAGE,
      role,
      timeout: cdk.Duration.minutes(15),
      memorySize: ctx.lambdaMemoryMB,
      environment: {
        S3_INPUT_BUCKET: ctx.s3InputBucketName,
        S3_INPUT_PREFIX: ctx.s3InputPrefix,
        S3_OUTPUT_BUCKET: outputBucket.bucketName,
        S3_OUTPUT_PREFIX: ctx.s3OutputPrefix,
      },
    });

    const api = new apigateway.RestApi(this, 'ManualTestApi', {
      restApiName: 'tidywigits-manual',
      description: 'Manual POST trigger for the tidywigits Lambda',
    });
    api.root.addMethod('POST', new apigateway.LambdaIntegration(fn));

    new cdk.CfnOutput(this, 'EcrRepoUri', {
      value: ecrRepo.repositoryUri,
      description: 'ECR repo where to push tidywigits container image',
    });
    new cdk.CfnOutput(this, 'OutputBucketName', {
      value: outputBucket.bucketName,
      description: 'S3 bucket for Parquet results',
    });
    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: fn.functionName,
    });
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'POST here to invoke Lambda manually',
    });
  }
}
