import test from "node:test";
import assert from "node:assert/strict";

import {
  loadRealEstateMarkersData,
  loadRealEstateTimeseriesData,
} from "./data.ts";

test("real estate data loaders cache fetch promises and parse assets", async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: string[] = [];

  const timeseriesPayload = {
    generatedAt: "2026-06-10T00:00:00Z",
    source: "test",
    summary: {
      totalRows: 1,
      residentialRows: 1,
      rowsWithCoordinates: 1,
      missingCoordinates: 0,
      rowsMissingDealDate: 0,
    },
    monthly: [
      {
        period: "2026-01",
        label: "Jan 2026",
        complete: true,
        districtDeals: 1,
        nonDistrictDeals: 2,
        districtMedianPricePerSqm: 100,
        nonDistrictMedianPricePerSqm: 200,
      },
    ],
    quarterly: [
      {
        period: "2026-Q1",
        label: "Q1 2026",
        complete: true,
        districtDeals: 3,
        nonDistrictDeals: 4,
        districtMedianPricePerSqm: 300,
        nonDistrictMedianPricePerSqm: 400,
      },
    ],
  };

  const markersPayload = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [34.8, 31.2],
        },
        properties: {
          id: "deal-1",
          periodMonth: "2026-01",
          periodQuarter: "2026-Q1",
          inInnovationDistrict: true,
          propertyCategory: "residential",
          propertyType: "apartment",
          dealAmount: 1000000,
          pricePerSqm: 10000,
          areaSqm: 100,
        },
      },
    ],
  };

  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      fetchCalls.push(url);

      if (url.includes("deals-timeseries.json")) {
        return Response.json(timeseriesPayload);
      }

      if (url.includes("deals-markers.geojson")) {
        return Response.json(markersPayload);
      }

      return new Response(null, { status: 404 });
    };

    const timeseriesFirst = loadRealEstateTimeseriesData();
    const timeseriesSecond = loadRealEstateTimeseriesData();
    assert.equal(timeseriesFirst, timeseriesSecond);

    const markersFirst = loadRealEstateMarkersData();
    const markersSecond = loadRealEstateMarkersData();
    assert.equal(markersFirst, markersSecond);

    const [timeseries, markers] = await Promise.all([timeseriesFirst, markersFirst]);

    assert.equal(timeseries?.monthly[0]?.districtDeals, 1);
    assert.equal(markers?.features[0]?.properties.id, "deal-1");
    assert.equal(fetchCalls.filter((url) => url.includes("deals-timeseries.json")).length, 1);
    assert.equal(fetchCalls.filter((url) => url.includes("deals-markers.geojson")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
