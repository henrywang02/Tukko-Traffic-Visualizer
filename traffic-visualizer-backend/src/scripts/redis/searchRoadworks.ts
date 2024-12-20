import { ParsedQs } from "qs";
import { buildParamsDict } from "./buildParamsDict";
import { roadworkRepository } from "./client";
import { Search } from "redis-om";

// Set allowed params for road work queries
const roadworkParams = new Set<string>([
  "primaryPointRoadNumber",
  "primaryPointRoadSection",
  "secondaryPointRoadNumber",
  "secondaryPointRoadSection",
  "startTimeOnAfter",
  "startTimeOnBefore",
  "severity",
]);

// Helper function to build a road work query based on params
function buildRoadworkQuery(paramsDict: Record<string, any>) {
  let query = roadworkRepository.search();
  // Get values for further checking
  const primaryPointRoadNumber = paramsDict["primaryPointRoadNumber"];
  const primaryPointRoadSection = paramsDict["primaryPointRoadSection"];
  const secondaryPointRoadNumber = paramsDict["secondaryPointRoadNumber"];
  const secondaryPointRoadSection = paramsDict["secondaryPointRoadSection"];
  // If all params defined and primary point's road number equals secondary point's road number, define a range between road sections
  if (
    primaryPointRoadNumber &&
    secondaryPointRoadNumber &&
    primaryPointRoadSection &&
    secondaryPointRoadSection
  ) {
    if (primaryPointRoadNumber === secondaryPointRoadNumber) {
      query = query.where((search) =>
        search
          .where((search) =>
            search
              .where("primaryPointRoadSection")
              .between(primaryPointRoadSection, secondaryPointRoadSection)
              .or("secondaryPointRoadSection")
              .between(secondaryPointRoadSection, primaryPointRoadSection)
          )
          .or((search) =>
            search
              .where("secondaryPointRoadSection")
              .between(primaryPointRoadSection, secondaryPointRoadSection)
              .or("secondaryPointRoadSection")
              .between(secondaryPointRoadSection, primaryPointRoadSection)
          )
      );
    }
    for (const param in paramsDict) {
      if (
        param !== "primaryPointRoadSection" &&
        param !== "secondaryPointRoadSection"
      ) {
        query = buildDefaultQuery(query, param, paramsDict[param]);
      }
    }
  }
  // Else if primary point's road number does not equal secondary point's road number, build the default query
  else {
    for (const param in paramsDict) {
      query = buildDefaultQuery(query, param, paramsDict[param]);
    }
  }
  return query;
}

// Helper function to build a query for a single param
function buildDefaultQuery(query: Search, param: string, value: any) {
  if (param === "startTimeOnAfter" || param === "startTimeOnBefore") {
    if (param === "startTimeOnAfter") {
      query = query.and("startTime").onOrAfter(value);
    } else {
      query = query.and("startTime").onOrBefore(value);
    }
  } else if (param === "severity") {
    // Protect against arrays
    if (Array.isArray(value)) {
      const arrayValues: any = value;
      let subquery = roadworkRepository.search();
      for (const arrayValue of arrayValues) {
        subquery = subquery.or(param).match(arrayValue);
      }
      query = query.where((search) => subquery);
    } else query = query.and(param).match(value);
  }
  return query;
}

// Search for road works based on provided params
async function searchRoadworks(params: ParsedQs): Promise<object[] | null> {
  try {
    let roadworks: object[] = [];
    // Query road works
    if (Object.keys(params).length === 0) {
      // If no params provided, get all road works
      roadworks = await roadworkRepository.search().return.all();
    } else {
      // Build dictionary for road work params
      const roadworkParamsDict = buildParamsDict(params, roadworkParams);
      // Query road works based on params
      roadworks = await buildRoadworkQuery(roadworkParamsDict).return.all({
        pageSize: 100,
      });
    }
    // Return null if list is empty
    return roadworks.length === 0 ? null : roadworks;
  } catch (error: any) {
    throw new Error("Error searching road works: " + error.message);
  }
}

// Export search functions
export default { searchRoadworks };
