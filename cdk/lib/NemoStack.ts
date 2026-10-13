import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { NemoContext } from '../helpers/parameters';

interface NemoStackProps extends cdk.StackProps {
  ctx: NemoContext;
}

export class NemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: NemoStackProps) {
    super(scope, id, props);

    const { ctx } = props;

    const ecrRepo = ecr.Repository.fromRepositoryName(this, 'NemoRepo', 'nemo-lambda');

    const outputBucket = s3.Bucket.fromBucketName(this, 'OutputBucket', ctx.s3OutputBucketName);

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
    // `aws s3 sync` lists the destination to diff against it
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:ListBucket'],
        resources: [outputBucket.bucketArn],
      }),
    );

    const fn = new lambda.Function(this, 'NemoFunction', {
      code: lambda.Code.fromEcrImage(ecrRepo, { tagOrDigest: ctx.imageTag }),
      handler: lambda.Handler.FROM_IMAGE,
      runtime: lambda.Runtime.FROM_IMAGE,
      role,
      timeout: cdk.Duration.minutes(15),
      memorySize: ctx.lambdaMemoryMB,
      // inputs and outputs both land in /tmp (default 512 MB)
      ephemeralStorageSize: cdk.Size.mebibytes(ctx.lambdaEphemeralStorageMB),
      // a failed async run is not retried: each attempt would mint a new
      // output_id and leave a partial output prefix behind
      retryAttempts: 0,
      environment: {
        S3_INPUT_BUCKET: ctx.s3InputBucketName,
        S3_OUTPUT_BUCKET: outputBucket.bucketName,
        // per-workflow detail-type + input/output prefixes, as JSON
        NEMO_WORKFLOWS: JSON.stringify(ctx.workflows),
        // fallback workflow when the event names none (e.g. API Gateway)
        NEMO_WORKFLOW: ctx.nemoWorkflow,
      },
    });

    const defaultBus = events.EventBus.fromEventBusName(this, 'DefaultBus', 'default');
    for (const wfConfig of Object.values(ctx.workflows)) {
      new events.Rule(this, `${wfConfig.detailType}Rule`, {
        eventBus: defaultBus,
        eventPattern: {
          detailType: [wfConfig.detailType],
        },
        targets: [new targets.LambdaFunction(fn)],
      });
    }

    const api = new apigateway.RestApi(this, 'ManualTestApi', {
      restApiName: 'nemo-manual',
      description: 'Manual POST trigger for the nemo Lambda',
      // no stage logging, so skip the account-wide AWS::ApiGateway::Account +
      // CloudWatch role, which another stack's deletion could otherwise orphan
      cloudWatchRole: false,
      // SigV4-signed requests only (e.g. awscurl); callers need execute-api:Invoke
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.IAM,
      },
    });
    api.root.addMethod(
      'POST',
      new apigateway.LambdaIntegration(fn, {
        proxy: false,
        requestParameters: {
          'integration.request.header.X-Amz-Invocation-Type': "'Event'",
        },
        integrationResponses: [{ statusCode: '202' }],
      }),
      { methodResponses: [{ statusCode: '202' }] },
    );

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: fn.functionName,
    });
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'POST here to invoke Lambda manually',
    });
  }
}
