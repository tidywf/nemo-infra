#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TidywigitsStack } from '../lib/TidywigitsStack';
import { getContext } from '../helpers/parameters';

const app = new cdk.App();
const ctx = getContext(app);

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new TidywigitsStack(app, 'TidywigitsStack', { ctx, env });
