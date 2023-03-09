"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

// curl -X POST http://localhost:1337/games/populate

module.exports = {
  populate: async (ctx) => {
    console.log("Starting to populate...");

    await strapi.services.game.populate();

    ctx.send("Finished populating!");
  },
};
