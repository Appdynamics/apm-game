/*
Use the following sample script as template for your custom scripts used with
nodejs and a "script,<filename>" command.

The parameter "$" comes with the following helpers:

- txn: The appdynamics transaction (see https://docs.appdynamics.com/display/PRO45/Node.js+Agent+API+Reference)
- logger: A log4js logger object (learn more at https://log4js-node.github.io/log4js-node/)
- add: A helper method to add data to analytics/snapshots
- sleep(n): A helper to stop the event loop for n milliseconds
- chance: Generator for randomness (learn more at https://chancejs.com/)

For examples see below

*/
module.exports = function($) {

  // Log with log level "info" that the script starts
  $.logger.info("Custom script start")

  // Add the price to snapshot&analytics data
  $.add("price", 15)

  // Add a random name to snapshot&analytics data
  $.add("name", $.chance.name())

  // With a 30% chance the execution is slowed down by 1.5 seconds
  if(chance.bool({likelihood: 30})) {
    $.sleep.msleep(1500)
  }

  // With another 30% chance, we return an error
  if($.chance.bool({likelihood: 30})) {
    return {code: 500, message: "Oops!"}
  }

  // The "add" method is just a wrapper around the AppDynamics API, with "txn" you can call those functions yourself
  $.txn.addAnalyticsData("note", "Add this data only to analytics")

  // Log with log level "debug" that the script ends
  $.logger.debug("Custom script end")

  // Will write "Hello World" to the output
  return "Hello World"
}
