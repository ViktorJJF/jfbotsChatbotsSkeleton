const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const config = require("./config");
const mongoose = require("mongoose");

const port = process.env.PORT || 3000;

// parse application/x-www-form-urlencoded
app.use(
  bodyParser.urlencoded({
    extended: false,
    limit: "20mb",
  })
);

mongoose.connect(
  config.DBSTRING,
  {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
  },
  (err, res) => {
    if (err) throw err;
    console.log("DB online ONLINE");
  }
);

//chatbots routes
// app.use("/messenger", require("./Facebook/facebookBot"));
require("./Telegram/telegramBot");

app.get("/", (req, res) => {
  return res.send("Todo OK iama");
});

// app.get("/github", (req, res) => {
//   return res.sendFile(__dirname + "/pull.php");
// });

let intervalo = 0;
setInterval(() => {
  intervalo++;
  console.log("Intervalo: ", intervalo);
}, 1 * 60 * 1000);
//api
// app.use("/api", require("./routes/api"));

// app.listen(port, () => {
//   console.log(`Escuchando peticiones en el puerto ${port}`);
// });
app.listen();
