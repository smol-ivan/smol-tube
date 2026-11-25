# Architecture Decision Records

Each record explains one decision: the context, what was decided, the alternatives, and the consequences, including the bad ones.

These records were written after the fact, in November 2026, from the code and from what I remember about why I made each choice. Where an alternative wasn't actually evaluated at the time, the record says so.

| ADR                                              | Decision                                             | Status   |
| ------------------------------------------------ | ---------------------------------------------------- | -------- |
| [0001](0001-serverless-websockets-on-aws.md)     | Serverless WebSockets on AWS                         | Accepted |
| [0002](0002-pure-domain-and-adapters.md)         | A pure domain package with thin adapters             | Accepted |
| [0003](0003-leader-based-playback-sync.md)       | Leader-based playback sync                           | Accepted |
| [0004](0004-aws-sam-for-iac.md)                  | AWS SAM for infrastructure as code                   | Accepted |
| [0005](0005-one-lambda-per-route.md)             | One Lambda function per WebSocket route              | Accepted |
| [0006](0006-room-as-a-single-dynamodb-item.md)   | A room is a single DynamoDB item                     | Accepted |
| [0007](0007-local-runner-for-lambda-handlers.md) | Run the Lambda handlers locally behind a `ws` server | Proposed |
| [0008](0008-astro-for-the-frontend.md)           | Astro for the frontend                               | Accepted |

New records use the same headings: **Context → Decision → Alternatives → Consequences**.
