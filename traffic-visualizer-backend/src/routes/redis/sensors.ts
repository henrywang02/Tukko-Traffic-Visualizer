import express from "express";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import redis from "../../scripts/redis/searchSensors";
import {
  validateSensorQueryParams,
  throwValidationError,
} from "./queryValidation";
import { fetchSensorLastUpdated } from "../../scripts/redis/lastUpdated";

// Compress responses using gzip
import zlib from "zlib";

// Set up the router
export const sensors = express.Router();

/**
 * @swagger
 * /sensors:
 *   get:
 *     summary: Retrieve a list of sensors.
 *     description: Retrieve a list of sensors. If no parameters are provided, all sensors are retrieved.
 *     parameters:
 *       - in: query
 *         name: lastUpdated
 *         schema:
 *           type: bool
 *           enum: [true, false]
 *         description: If parameter is given, result will contain only update timestamp for sensors.
 *         required: false
 *         example: false
 *       - in: query
 *         name: id
 *         schema:
 *           type: integer
 *         description: Query sensors based on a sensor ID. Array params supported.
 *         required: false
 *         example: 5119
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: integer
 *         description: Query sensors based on a station ID. Array params supported.
 *         required: false
 *         example: 24607
 *       - in: query
 *         name: measuredTimeOnAfter
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Query sensors based on the last measured UTC timestamp. Returns sensors with sensor values measured on or after the defined datetime. Can be used in combination with measuredTimeOnBefore to define a range.
 *         required: false
 *         example: 2020-05-30T15:13:26.000Z
 *       - in: query
 *         name: measuredTimeOnBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Query sensors based on the last measured UTC timestamp. Returns sensors with sensor values measured on or before the defined datetime. Can be used in combination with measuredTimeOnAfter to define a range.
 *         required: false
 *         example: 2030-05-30T15:13:26.000Z
 *       - in: query
 *         name: valueGte
 *         schema:
 *           type: number
 *           format: float
 *         description: Query sensors based on the value of a sensor. Returns sensors with sensor values greater than or equal to the defined value. Can be used in combination with ValueLte to define a range.
 *         required: false
 *         example: 10
 *       - in: query
 *         name: valueLte
 *         schema:
 *           type: number
 *           format: float
 *         description: Query sensors based on the value of a sensor. Returns sensors with sensor values less than or equal to the defined value. Can be used in combination with ValueGte to define a range.
 *         required: false
 *         example: 5000
 *     responses:
 *       200:
 *         description: A list of sensors.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Sensor ID.
 *                     example: 5119
 *                   stationId:
 *                     type: integer
 *                     description: Station ID.
 *                     example: 24607
 *                   name:
 *                     type: string
 *                     description: Sensor name.
 *                     example: OHITUKSET_5MIN_LIUKUVA_SUUNTA2
 *                   timeWindowStart:
 *                     type: string
 *                     format: date-time
 *                     description: UTC timestamp of the latest measurement start datetime.
 *                     example: 2023-06-23T08:58:21.000Z
 *                   timeWindowEnd:
 *                     type: string
 *                     format: date-time
 *                     description: UTC timestamp of the latest measurement end datetime.
 *                     example: 2023-06-23T08:58:21.000Z
 *                   measuredTime:
 *                     type: string
 *                     format: date-time
 *                     description: UTC timestamp of the latest sensor value.
 *                     example: 2023-06-23T08:58:21.000Z
 *                   unit:
 *                     type: string
 *                     description: Sensor measurement unit.
 *                     example: kpl/h
 *                   value:
 *                     type: number
 *                     format: float
 *                     description: Sensor value.
 *                     example: 100
 *       400:
 *         description: Invalid parameter value.
 *       404:
 *         description: Sensors are not found.
 *       500:
 *         description: Internal server error.
 */
sensors.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get query params dictionary
    const params = req.query;
    let data = null;
    // Check for lastUpdated bool
    const lastUpdated = params["lastUpdated"];
    if (lastUpdated && lastUpdated === "true") {
      data = await fetchSensorLastUpdated();
    } else if (lastUpdated && lastUpdated !== "false") {
      throwValidationError("lastUpdated");
    } else {
      // Validate query parameters
      validateSensorQueryParams(params);
      // Search data based on the provided params
      data = await redis.searchSensors(params);
      // If no data is found, respond with the 404 status code
      if (data === null) {
        const error: any = new Error(`No sensors found.`);
        error.error = "Not Found";
        error.statusCode = StatusCodes.NOT_FOUND;
        throw error;
      }
    }

    data = zlib.gzipSync(JSON.stringify(data))

    // Set the appropriate headers
    res.set({
      "Content-Encoding": "gzip",
      "Content-Type": "application/json",
    });

    // Send the response
    res.status(StatusCodes.OK).send(data);
  } catch (err) {
    // Pass the error to the error handling middleware
    next(err);
  }
});

// Error handling middleware
sensors.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  // Determine an appropriate status code based on the error
  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  // Return the error message with the appropriate status code
  res.setHeader("Content-Type", "application/json");
  const errorResponse = {
    statusCode: statusCode,
    error: statusCode === 500 ? "Internal Server Error" : err.error,
    message: err.message,
  };
  res.status(statusCode).json(errorResponse);
});
