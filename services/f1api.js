const axios = require('axios');

const BASE = 'https://api.jolpica.com/ergast/f1';

async function fetchQualifyingResults(season, round) {
  const url = `${BASE}/${season}/${round}/qualifying.json`;
  const { data } = await axios.get(url, { timeout: 10000 });
  const race = data?.MRData?.QualifyingTable?.Races?.[0];
  if (!race) return null;
  return race.QualifyingResults.map(r => ({
    position: parseInt(r.position, 10),
    driver:   r.Driver.familyName,
  }));
}

async function fetchRaceResults(season, round) {
  const url = `${BASE}/${season}/${round}/results.json`;
  const { data } = await axios.get(url, { timeout: 10000 });
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race) return null;
  return race.Results.slice(0, 10).map(r => ({
    position: parseInt(r.position, 10),
    driver:   r.Driver.familyName,
  }));
}

async function fetchSprintResults(season, round) {
  const url = `${BASE}/${season}/${round}/sprint.json`;
  const { data } = await axios.get(url, { timeout: 10000 });
  const race = data?.MRData?.RaceTable?.Races?.[0];
  if (!race) return null;
  return race.SprintResults.slice(0, 3).map(r => ({
    position: parseInt(r.position, 10),
    driver:   r.Driver.familyName,
  }));
}

module.exports = { fetchQualifyingResults, fetchRaceResults, fetchSprintResults };
