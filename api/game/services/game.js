"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

const axios = require("axios");
const slugify = require("slugify");

async function getGameInfo(slug) {
  const jsdom = require("jsdom");
  const { JSDOM } = jsdom;
  const body = await axios.get(`https://www.gog.com/game/${slug}`);
  const dom = new JSDOM(body.data);

  const ratingElement = dom.window.document.querySelector(
    ".age-restrictions__icon use"
  );

  const description = dom.window.document.querySelector(".description");

  return {
    rating: ratingElement
      ? ratingElement
          .getAttribute("xlink:href")
          .replace(/_/g, "")
          .replace(/[^\w-]+/g, "")
      : "FREE",
    short_description: description.textContent.trim().slice(0, 160),
    description: description.innerHTML,
  };
}

async function getByName(name, entityName) {
  const item = await strapi.services[entityName].find({ name });
  return item.length ? item[0] : null;
}

async function create(name, entityName) {
  const item = await getByName(name, entityName);

  if (!item) {
    return await strapi.services[entityName].create({
      name,
      slug: slugify(name, { strict: true, lower: true }),
    });
  }
}

async function createManyToManyData(products) {
  const developers = new Set();
  const publishers = new Set();
  const categories = new Set();
  const platforms = new Set();

  products.forEach((product) => {
    const { developer, publisher, genres, supportedOperatingSystems } = product;

    genres?.forEach((item) => {
      categories.add(item);
    });

    supportedOperatingSystems?.forEach((item) => {
      platforms.add(item);
    });

    developers.add(developer);
    publishers.add(publisher);
  });

  const createCall = (set, entityName) =>
    Array.from(set).map((name) => create(name, entityName));

  return Promise.all([
    ...createCall(developers, "developer"),
    ...createCall(publishers, "publisher"),
    ...createCall(categories, "category"),
    ...createCall(platforms, "platform"),
  ]);
}

async function createGames(products) {
  await Promise.all(
    products.map(async (product) => {
      const item = await getByName(product.title, "game");

      if (!item) {
        console.info(`Creating: ${product.title}...`);

        const game = await strapi.services.game.create({
          name: product.title,
          slug: product.slug.replace(/_/g, "-"),
          price: product.price.amount,
          release_date: new Date(
            Number(product.globalReleaseDate) * 1000
          ).toISOString(),
          categories: await Promise.all(
            product.genres.map((name) => getByName(name, "category"))
          ),
          platforms: await Promise.all(
            product.supportedOperatingSystems.map((name) =>
              getByName(name, "platform")
            )
          ),
          developers: [await getByName(product.developer, "developer")],
          publisher: await getByName(product.publisher, "publisher"),
          ...(await getGameInfo(product.slug)),
        });

        return game;
      }
    })
  );
}

module.exports = {
  populate: async (params) => {
    const gogApiUrl = `https://www.gog.com/games/ajax/filtered?mediaType=game&page=1&sort=popularity`;
    const {
      data: { products },
    } = await axios.get(gogApiUrl);

    await createManyToManyData([products[2], products[3]]);
    await createGames([products[2], products[3]]);
  },
};
