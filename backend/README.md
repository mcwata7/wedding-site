# Wedding Planning Service

Java 21 / Spring Boot API for planner and guest wedding workflows.

## Run locally

1. Copy `.env.example` to `.env` at the repository root and replace every secret.
2. From the repository root, run `docker compose up --build`.
3. Open API documentation at `http://localhost:8080/swagger-ui.html` and health at `http://localhost:8080/actuator/health`.

The initial planner is seeded from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Planner login is `POST /api/v1/auth/planner/login`. Guests start a session through `POST /api/v1/guest/sessions` using their QR token and invitation verification answer.

The API accepts bearer tokens in `Authorization: Bearer <token>`. QR tokens and answers must be generated/printed only after the relevant party and invitation have been created.
