#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NemoStack } from '../lib/NemoStack';
import { getContext } from '../helpers/parameters';

const app = new cdk.App();
const ctx = getContext(app);

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new NemoStack(app, 'NemoStack', { ctx, env });
