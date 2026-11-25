# Documentation

Start with the [project README](../README.md) for the overview, then:

| Document                                  | What it covers                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Architecture](architecture.md)           | Packages, domain model and permissions, request lifecycle, event contract, DynamoDB layout     |
| [Playback sync](playback-sync.md)         | Leader model, leader/follower player logic, YouTube IFrame API pitfalls                        |
| [Infrastructure](infrastructure.md)       | SAM stack (WebSocket API, Lambdas, tables, IAM), packaging, secrets, resources created by hand |
| [CI/CD](ci-cd.md)                         | GitHub Actions workflows, secrets, how deploys are triggered, known pipeline gaps              |
| [Local development](local-development.md) | Nix/direnv setup, environment variables, what runs locally today, the planned local runner     |
| [Decision records](adr/README.md)         | Why the main architecture choices were made, their alternatives and their costs                |
