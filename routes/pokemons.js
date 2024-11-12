const crypto = require("crypto");
const fs = require("fs");
const csv = require("csv-parser");
const express = require("express");
const path = require("path");
const router = express.Router();
const pokemonData = [];

// get all pokemons from csv file
async function loadPokemonData() {
  return new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, "../assets/pokemons.csv"))
      .pipe(csv())
      .on("data", async (row) => {
        const pokemon = {
          id: parseInt(row.id),
          name: row.Name.toLowerCase(),
          types: [row.Type1, row.Type2].filter(Boolean),
          url: `http://localhost:8000/images/${row.id}.png`,
        };

        try {
          // Fetch additional data for Pokémon
          const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${row.Name.toLowerCase()}`);
          const pokemonDataApi = await pokemonResponse.json();
          const height = parseFloat((pokemonDataApi.height * 0.1).toFixed(2));
          const weight = parseFloat((pokemonDataApi.weight * 0.1).toFixed(2));
          const abilities = pokemonDataApi.abilities.map((ability) => ability.ability.name);

          // Fetch species data (for flavor text)
          const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${row.Name.toLowerCase()}`);
          const speciesData = await speciesResponse.json();
          const flavorText = speciesData.flavor_text_entries.find((entry) => entry.language.name === "en")?.flavor_text;
          const cleanedFlavorText = flavorText ? flavorText.replace(/[\n\r\f]/g, " ") : "No data available";

          pokemon.height = height;
          pokemon.weight = weight;
          pokemon.abilities = abilities;
          pokemon.description = cleanedFlavorText;
          pokemon.category = "unknown";
        } catch (error) {
          // Fallback values if API call fails
          pokemon.height = parseFloat((Math.random() * 10).toFixed(2));
          pokemon.weight = parseFloat((Math.random() * 100).toFixed(2));
          pokemon.abilities = [];
          pokemon.description = "No data available";
          pokemon.category = "unknown";
        }

        pokemonData.push(pokemon);
      })
      .on("end", () => {
        // pokemonData.sort((a, b) => a.id - b.id);
        isDataLoaded = true;
        resolve();
        console.log("CSV file successfully processed and data loaded.");
      });
  });
}

// Initialize Pokémon data before setting up routes
loadPokemonData();

// get all pokemons
router.get("/", (req, res, next) => {
  try {
    // Get query parameters for pagination, search, and type
    const { page = 1, limit = 10, search, type } = req.query;

    // Convert page and limit to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Filter Pokémon data by search and type if provided
    const typeLower = type ? type.toLowerCase() : null;
    const nameLower = search ? search.toLowerCase() : null;

    const filteredPokemons = pokemonData.filter((pokemon) => {
      const matchesType = typeLower
        ? pokemon.types.map((t) => t.toLowerCase()).includes(typeLower)
        : true;
      const matchesName = nameLower ? pokemon.name.includes(nameLower) : true;
      return matchesType && matchesName;
    });

    // Calculate the total number of Pokémon
    const totalPokemons = filteredPokemons.length;

    // Apply pagination
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedPokemons = filteredPokemons.slice(startIndex, startIndex + limitNum);

    // Return the response with the paginated data
    res.json({
      data: paginatedPokemons.map((pokemon) => ({
        id: pokemon.id,
        name: pokemon.name,
        types: pokemon.types,
        url: pokemon.url,
      })),
      totalPokemons: totalPokemons,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", (req, res, next) => {
  const pokemonId = parseInt(req.params.id);
  const currentPokemon = pokemonData.find(
    (pokemon) => pokemon.id === pokemonId
  );

  if (!currentPokemon) {
    return res.status(404).json({ message: "Pokemon not found" });
  }
  // check if id is at the begining or at the end
  const pokemonsSize = pokemonData.length;
  const maxPokemonId = Math.max(...pokemonData.map(pokemon => pokemon.id));
  const previousId = pokemonId === 1 ? maxPokemonId : pokemonId - 1;
  const nextId = pokemonId >= pokemonsSize ? 1 : pokemonId + 1;

  const previousPokemon = pokemonData.find(
    (pokemon) => pokemon.id === previousId
  );
  const nextPokemon = pokemonData.find((pokemon) => pokemon.id === nextId);
  currentPokemon.types = currentPokemon.types.map(type => type.toLowerCase());
  // create responce
  const response = {
    data: {
      pokemon: currentPokemon,
      previousPokemon: previousPokemon || null,
      nextPokemon: nextPokemon || null,
    }
  };
  // convert to json
  res.json(response);
});

// create pokemon
const pokemonTypes = [
  "bug",
  "dragon",
  "fairy",
  "fire",
  "ghost",
  "ground",
  "normal",
  "psychic",
  "steel",
  "dark",
  "electric",
  "fighting",
  "flyingText",
  "grass",
  "ice",
  "poison",
  "rock",
  "water",
];

router.post('/', (req, res, next) => {
  try {
    const { name, id, types, url } = req.body;
    // Missing data handler
    if (!name || !id || !types || !url) {
      return res.status(400).json({ message: "Missing required data." });
    }

    // Check if Pokemon already exists
    const pokemonExists = pokemonData.find(pokemon => pokemon.id === id || pokemon.name === name.toLowerCase());
    if (pokemonExists) {
      return res.status(400).json({ message: "The Pokemon already exists." });
    }

    // Validate the types (1 or 2 types, and they should be valid)
    if (types.length < 1 || types.length > 2) {
      return res.status(400).json({ message: "Pokemon can only have one or two types." });
    }
    
    const invalidTypes = types.filter(type => !pokemonTypes.includes(type.toLowerCase()));
    if (invalidTypes.length > 0) {
      return res.status(400).json({ message: "Pokemon's type is invalid." });
    }

    // Create the new Pokémon object
    const newPokemon = {
      id: parseInt(id),
      name: name.toLowerCase(),
      types: types.map(type => type.toLowerCase()),
      url,
      height: parseFloat((Math.random() * 10).toFixed(2)),
      weight: parseFloat((Math.random() * 100).toFixed(2)),
      description: "No data available",
      category: "unknown",
      abilities: [],

    };

    // Add the new Pokémon to the data set
    pokemonData.push(newPokemon);

    res.status(201).json({
      message: "New Pokémon added successfully.",
      pokemon: newPokemon,
    });
  } catch (error) {
    next(error);
  }  
})

// delete pokemon
router.delete("/:id", (req, res, next) => {
  const pokemonId = parseInt(req.params.id);

  // Find the index of the Pokémon to delete
  const pokemonIndex = pokemonData.findIndex((pokemon) => pokemon.id === pokemonId);

  if (pokemonIndex === -1) {
    return res.status(404).json({ message: "Pokemon not found" });
  }

  // Remove the Pokémon from the array
  pokemonData.splice(pokemonIndex, 1);

  res.json({ message: "Pokemon deleted successfully" });
});



module.exports = router;
