// Date tests assert Chicago wall-clock times, including the DST changes.
// Assigning process.env.TZ inside a test file never reaches Node under Jest
// (each test environment gets its own copy of process.env), so those tests
// silently ran in the machine's zone — UTC in CI. Pin the zone for the run.
module.exports = () => {
  process.env.TZ = 'America/Chicago'
}
