import express, { type Express } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import * as fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function loadEnvFiles() {
  const envLocal = path.resolve(process.cwd(), ".env.local");
  const envDefault = path.resolve(process.cwd(), ".env");

  // Load .env.local first (if it exists)
  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal });
  }

  // Load .env second, allowing it to override .env.local
  dotenv.config({ path: envDefault });

  // You can add more specific .env files here if needed
  // For example: .env.development.local, .env.test.local, etc.
}

loadEnvFiles();

const app: Express = express();
// eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in workspace turbo.json
const port = parseInt(process.env.PORT || "", 10) || 2999;
// eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in workspace turbo.json
const host = process.env.HOST || "0.0.0.0";

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Filefly Relay Server API",
      version: "1.0.0",
      description: "API documentation for the Filefly Relay Server",
    },
  },
  apis: ["./src/**/*.ts"], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Start the server
app.listen(port, host, () => {
  console.log(`Filefly Relay Server running at http://localhost:${port}`);
  console.log(
    `API documentation available at http://localhost:${port}/api-docs`,
  );
});
