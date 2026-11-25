# 0004. AWS SAM for infrastructure as code

- **Status:** Accepted
- **Recorded:** 2026-11-25 (retroactive)

## Context

I had already used Terraform for a previous site. This project is event-driven from end to end: every WebSocket message is an event that triggers a function. The backend is API Gateway, Lambda and DynamoDB, with no VPC, containers or servers.

## Decision

Describe the backend with **AWS SAM** ([`template.yml`](../../template.yml)) and deploy it with `sam deploy` as one CloudFormation stack.

My reasons at the time:

- SAM is designed for event-driven serverless apps. Everything here is an event.
- Its syntax for API Gateway, Lambda and DynamoDB looked simpler than writing the equivalent Terraform.
- It promised local testing (`sam local`).
- Its policy templates (`DynamoDBCrudPolicy`) seemed to make permissions simpler.

## Alternatives

- **Terraform**, which I had used before. It's multi-cloud, has a large ecosystem and would cover the frontend hosting and DNS too, but needs more boilerplate for Lambda packaging and permissions.
- **AWS CDK.** Infrastructure in TypeScript, the same language as the app. Not evaluated.
- **Serverless Framework.** Similar goals to SAM. Not evaluated.

## Consequences

**Good**

- One command builds and deploys the whole backend, and CloudFormation tracks it as a stack that can be rolled back or deleted.
- `DynamoDBCrudPolicy` and the generated execution roles saved writing IAM documents by hand.
- `{{resolve:ssm:...}}` pulls the YouTube key from SSM without a secret in the repo.

**What turned out differently**

- **SAM has no WebSocket shorthand.** `AWS::Serverless::Api` and `HttpApi` only cover REST and HTTP APIs. The WebSocket API, stage, integrations, routes and invoke permissions are raw `AWS::ApiGatewayV2::*` CloudFormation resources. Each route takes four resources, and the template is about 550 lines for 11 routes.
- **`sam local` doesn't emulate WebSocket APIs.** It can invoke one handler with a hand-written event, but it can't run the app end to end. See [0007](0007-local-runner-for-lambda-handlers.md).
- **`DynamoDBCrudPolicy` is broad.** It grants full CRUD on a table, which is easy but not least privilege.
- **The stack only covers the backend.** The S3 bucket, CloudFront, DNS and the CI user were made by hand. Bringing them in means adding them to this template (or a second stack), or using Terraform for the parts outside SAM's sweet spot.
