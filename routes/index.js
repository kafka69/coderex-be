var express = require('express');
var path = require("path");
var router = express.Router();
// access image static files
router.use("/images", express.static(path.join(__dirname, "../assets/pokemon")));
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

const pokeRouter = require("./pokemons.js")
router.use('/api/pokemons',pokeRouter)
module.exports = router;
