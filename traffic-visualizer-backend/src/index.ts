import { tmsRouter } from "./routes/tms_data";
import { connect } from "./scripts/mongo";
import { mongoFetch} from "./scripts/saveToMongo";
import cors from "cors";

// ---------------------------------------- REDIS SERVER ----------------------------------------
// Dependencies
require("dotenv").config();
import express from "express";
import compression from "compression";
const swaggerUi = require("swagger-ui-express");
import { swaggerSpec } from "./scripts/swagger";
import { loadStations } from "./scripts/redis/loadStations";
import { loadSensors } from "./scripts/redis/loadSensors";
import { loadRoadworks } from "./scripts/redis/loadRoadworks";
import { stations } from "./routes/redis/stations";
import { sensors } from "./routes/redis/sensors";
import { roadworks } from "./routes/redis/roadworks";
import { scheduleScript } from "./scripts/schedule";
import { authRouter } from "./scripts/auth.controller";

// Set up the server
export const app = express();
// Default port for backend is 3001
export const port = (process.env.PORT || 3001) as number;



app.use(cors({
  origin: [
    // new RegExp('localhost'), 
    // more origins for prod
    process.env?.FORNTEND_ORIGIN || false
  ]
}));
// Add compression
app.use(compression());

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// Use the routes
app.use("/stations", stations);
app.use("/sensors", sensors);
app.use("/roadworks", roadworks);
app.use("/auth", authRouter)
// Set up the Swagger route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Schedule data loading processes for Redis database with a rate in milliseconds
scheduleScript(loadStations, 0, 60000 /* rate=1min */);
scheduleScript(loadSensors, 0, 60000 /* rate=1min */);
scheduleScript(loadRoadworks, 0, 60000 /* rate=1min */);
// -----------------------------------------------------------------------------------------------

// ---------------------------------------- MONGO SERVER ----------------------------------------

// Call the runMongoFetchInterval function to start fetching data repeatedly
connect().then(async (): Promise<void> => {
  app.use("/tms", tmsRouter);
}).finally(() => runMongoFetchInterval());

// Run the mongoFetch function repeatedly for a set amount of time
async function runMongoFetchInterval(): Promise<void> {
  while (true) {
    await mongoFetch();
    await delay(5 *60 * 1000); // Update every 5 mins && Wait for 1 hour before the next fetch
  }
}

// Delay the function for a given amount of milliseconds
async function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}


